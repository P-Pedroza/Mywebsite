const path = require('path');
const { loadWorkflows, setWorkflows, runWorkflow } = require('./n8n_sim.js');

const WF_DIR = process.argv[2] || path.join(__dirname, '..');
setWorkflows(loadWorkflows(WF_DIR));

function freshStores() {
  return { sheets: {}, gmailLog: [], telegramLog: [], gmailShouldFail: false };
}

function seedApprovalRow(stores, row) {
  const key = 'YTUMA_EMAIL_APPROVALS_SHEET_ID::Sheet1';
  stores.sheets[key] = stores.sheets[key] || [];
  stores.sheets[key].push(row);
}

function seedClientRow(stores, row) {
  const key = 'YTUMA_CLIENT_REGISTRY_SHEET_ID::Clients';
  stores.sheets[key] = stores.sheets[key] || [];
  stores.sheets[key].push(row);
}

function assert(cond, msg) {
  if (!cond) { console.log('  FAIL: ' + msg); return false; }
  console.log('  pass: ' + msg);
  return true;
}

function telegramMessage(text, chatId, username) {
  return { message: { text, chat: { id: chatId }, from: { username } } };
}

// ---------------------------------------------------------------
console.log('=== SCENARIO A: approve -> send succeeds ===');
{
  const stores = freshStores();
  seedClientRow(stores, {
    client_id: 'test-client', client_name: 'Test Client Co', status: 'active',
    calendar_id: 'test-client@group.calendar.google.com',
    crm_sheet_id: 'TEST_CRM_SHEET', journal_doc_id: 'TEST_JOURNAL_DOC',
    memory_rejections_doc_id: 'TEST_REJ_DOC', knowledge_base_folder_id: 'TEST_KB_FOLDER',
    pinecone_namespace: '', alex_profile_file_id: 'x', preferences_file_id: 'x',
    patterns_file_id: 'x', memory_log_file_id: 'x', sol_learnings_file_id: 'x',
    admin_email: 'agency-admin@example.com', admin_telegram_chat_id: '555',
    twilio_number: '+15550001111', email_sender_workflow_id: '', preferred_language: 'en'
  });
  seedApprovalRow(stores, {
    approval_code: 'LEGACY1', approval_id: '260125-TESTAPPR1', client_id: 'test-client',
    channel: 'email', to_email: 'client-contact@example.com', subject: 'Follow-up on your request',
    body: 'Hi, following up on your request from last week. Let me know if you have questions.',
    summary_for_boss: 'To: client-contact@example.com...', status: 'pending_approval',
    created_at: '2026-07-25T10:00:00.000Z', last_action: 'draft_created'
  });

  const trace = [];
  let threw = null;
  try {
    runWorkflow('11_YTUMA_Email_Approval_Handler', telegramMessage('approve 260125-TESTAPPR1', 999, 'alex'), stores, trace, '');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow ran without throwing');
  const row = stores.sheets['YTUMA_EMAIL_APPROVALS_SHEET_ID::Sheet1'].find(r => r.approval_id === '260125-TESTAPPR1');
  ok &= assert(row && row.status === 'approved', 'approvals row flipped to status=approved (got: ' + (row && row.status) + ')');
  ok &= assert(row && row.approved_by === 'alex', 'approved_by recorded correctly');
  const sent = stores.gmailLog.find(g => g.to === 'client-contact@example.com');
  ok &= assert(!!sent, 'Gmail actually sent to the client (this was the missing link before the fix)');
  ok &= assert(sent && sent.subject === 'Follow-up on your request', 'sent email has correct subject');
  ok &= assert(sent && sent.message === row.body, 'sent email body matches the approved draft body');
  const confirm = stores.telegramLog.find(t => t.chatId === 999 && /approved and sent/.test(t.text));
  ok &= assert(!!confirm, 'admin got a Telegram confirmation saying "approved and sent"');
  console.log(ok ? '=> SCENARIO A: PASS\n' : '=> SCENARIO A: FAIL\n');
}

// ---------------------------------------------------------------
console.log('=== SCENARIO B: approve -> Gmail persistently fails -> retries -> escalates ===');
{
  const stores = freshStores();
  stores.gmailShouldFail = true; // simulates a dead/expired Gmail credential
  seedClientRow(stores, {
    client_id: 'test-client', client_name: 'Test Client Co', status: 'active',
    calendar_id: 'test-client@group.calendar.google.com',
    crm_sheet_id: 'TEST_CRM_SHEET', journal_doc_id: 'TEST_JOURNAL_DOC',
    memory_rejections_doc_id: 'TEST_REJ_DOC', knowledge_base_folder_id: 'TEST_KB_FOLDER',
    pinecone_namespace: '', alex_profile_file_id: 'x', preferences_file_id: 'x',
    patterns_file_id: 'x', memory_log_file_id: 'x', sol_learnings_file_id: 'x',
    admin_email: 'agency-admin@example.com', admin_telegram_chat_id: '555',
    twilio_number: '+15550001111', email_sender_workflow_id: '', preferred_language: 'en'
  });
  seedApprovalRow(stores, {
    approval_code: 'LEGACY2', approval_id: '260125-TESTAPPR2', client_id: 'test-client',
    channel: 'email', to_email: 'client-contact@example.com', subject: 'Second draft',
    body: 'Body of the second draft.', summary_for_boss: 'summary', status: 'pending_approval',
    created_at: '2026-07-25T10:00:00.000Z', last_action: 'draft_created'
  });

  const trace = [];
  let threw = null;
  try {
    runWorkflow('11_YTUMA_Email_Approval_Handler', telegramMessage('approve 260125-TESTAPPR2', 999, 'alex'), stores, trace, '');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow ran without throwing despite persistent Gmail failure');
  const row = stores.sheets['YTUMA_EMAIL_APPROVALS_SHEET_ID::Sheet1'].find(r => r.approval_id === '260125-TESTAPPR2');
  ok &= assert(row && row.status === 'approved', 'approvals row STILL flips to approved (reflects the human decision, independent of send outcome)');
  const clientSend = stores.gmailLog.find(g => g.to === 'client-contact@example.com');
  ok &= assert(!clientSend, 'no successful send was ever recorded to the client (Gmail was down the whole time)');
  const errKey = Object.keys(stores.sheets).find(k => k.includes('OBSERVABILITY'));
  const errLog = stores.sheets[errKey + ''] || [];
  const dedupeKey = Object.keys(stores.sheets).find(k => k.startsWith('YTUMA_OBSERVABILITY_SHEET_ID::Alert_Dedupe'));
  const errorLogKey = Object.keys(stores.sheets).find(k => k.startsWith('YTUMA_OBSERVABILITY_SHEET_ID::Error_Log'));
  ok &= assert(!!errorLogKey && stores.sheets[errorLogKey].length >= 1, '99_Error_Handler logged at least one Error_Log row');
  ok &= assert(!!dedupeKey && stores.sheets[dedupeKey].length === 1, 'exactly one Alert_Dedupe row created for this failure');
  // Gmail alert is EXPECTED to also fail here: Notify-Admin shares the same Gmail credential as the
  // client send in this scenario, so a fully-dead Gmail account legitimately takes out both. That's why
  // 99_Error_Handler also has an independent Telegram alert path - assert THAT one got through instead.
  const alertTelegram = stores.telegramLog.find(t => t.node === 'Notify - Admin (Telegram)' && /test-client/.test(t.text));
  ok &= assert(!!alertTelegram, 'the independent Telegram admin alert got through even though Gmail (shared credential) was completely dead');
  const confirm = stores.telegramLog.find(t => t.chatId === 999 && /failed\/is retrying/.test(t.text));
  ok &= assert(!!confirm, 'admin got a Telegram warning (not a false "sent" message) — text: ' + (confirm && confirm.text));
  console.log(ok ? '=> SCENARIO B: PASS\n' : '=> SCENARIO B: FAIL\n');
}
