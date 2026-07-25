const path = require('path');
const { loadWorkflows, setWorkflows, runWorkflow } = require('./n8n_sim.js');

const WF_DIR = process.argv[2] || path.join(__dirname, '..');
setWorkflows(loadWorkflows(WF_DIR));

function freshStores() {
  return {
    sheets: {}, gmailLog: [], telegramLog: [], twilioLog: [], webhookResponses: [], brainLog: [],
    gmailShouldFail: false, twilioShouldFail: false,
    brainOutput: (input) => `Hi, this is Sol calling on behalf of Test Client Co about: ${input.prompt ? input.prompt.slice(0, 40) : ''}`,
  };
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

function defaultClientRow(overrides) {
  return Object.assign({
    client_id: 'test-client', client_name: 'Test Client Co', status: 'active',
    calendar_id: 'test-client@group.calendar.google.com',
    crm_sheet_id: 'TEST_CRM_SHEET', journal_doc_id: 'TEST_JOURNAL_DOC',
    memory_rejections_doc_id: 'TEST_REJ_DOC', knowledge_base_folder_id: 'TEST_KB_FOLDER',
    pinecone_namespace: '', alex_profile_file_id: 'x', preferences_file_id: 'x',
    patterns_file_id: 'x', memory_log_file_id: 'x', sol_learnings_file_id: 'x',
    admin_email: 'agency-admin@example.com', admin_telegram_chat_id: '555',
    twilio_number: '+15551230000', email_sender_workflow_id: '', preferred_language: 'en'
  }, overrides || {});
}

function crmRows(stores) {
  return stores.sheets['TEST_CRM_SHEET::Interactions'] || [];
}

// ---------------------------------------------------------------
console.log('=== SCENARIO C: outbound call placed for the right client, from the right number ===');
{
  const stores = freshStores();
  seedClientRow(stores, defaultClientRow());

  const trace = [];
  let threw = null;
  let result;
  try {
    result = runWorkflow('08_YTUMA_Phone_Outbound_Caller', {
      body: { client_id: 'test-client', to_phone: '3175551111', contact_name: 'Jane Doe', purpose: 'Following up on listing inquiry' }
    }, stores, trace, '');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow ran without throwing');
  ok &= assert(stores.brainLog.length === 1 && stores.brainLog[0].input.client_id === 'test-client', 'Brain was called with the correct client_id');
  const call = stores.twilioLog[0];
  ok &= assert(!!call, 'Twilio call was placed');
  ok &= assert(call && call.from === '+15551230000', 'call placed FROM the client\'s own registry number, not a hardcoded fallback (got: ' + (call && call.from) + ')');
  ok &= assert(call && call.to === '+13175551111', 'call placed TO the normalized E.164 number (got: ' + (call && call.to) + ')');
  ok &= assert(call && /Following up on listing inquiry|Test Client Co/.test(call.twiml), 'TwiML contains the Brain-generated script');
  const rows = crmRows(stores);
  const row = rows.find(r => r.contact_phone === '+13175551111');
  ok &= assert(!!row, 'an Interactions row was logged to the CLIENT\'s own CRM sheet');
  ok &= assert(row && row.client_id === 'test-client', 'CRM row tagged with correct client_id');
  ok &= assert(row && row.direction === 'outbound' && row.channel === 'phone', 'CRM row correctly tagged phone/outbound');
  const resp = stores.webhookResponses[0];
  ok &= assert(!!resp && /queued/.test(JSON.stringify(resp.body)), 'webhook responded with a queued status');
  console.log(ok ? '=> SCENARIO C: PASS\n' : '=> SCENARIO C: FAIL\n');
}

// ---------------------------------------------------------------
console.log('=== SCENARIO D: inbound call greeting names the right client ===');
{
  const stores = freshStores();
  seedClientRow(stores, defaultClientRow());

  const trace = [];
  let threw = null;
  let result;
  try {
    result = runWorkflow('09b_YTUMA_Phone_Inbound_Receptionist', {
      body: { To: '+15551230000', From: '+13175559999' }
    }, stores, trace, '', 'Start - Phone Inbound');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow ran without throwing');
  const resp = stores.webhookResponses[0];
  ok &= assert(!!resp, 'a TwiML response was produced');
  ok &= assert(resp && /Test Client Co/.test(resp.body), 'greeting mentions the RIGHT client, resolved purely from the number dialed (got: ' + (resp && resp.body) + ')');
  ok &= assert(resp && /<Gather/.test(resp.body), 'greeting includes a <Gather> so the caller can respond');
  console.log(ok ? '=> SCENARIO D: PASS\n' : '=> SCENARIO D: FAIL\n');
}

// ---------------------------------------------------------------
console.log('=== SCENARIO E: inbound speech gets a reply and gets logged to the right CRM ===');
{
  const stores = freshStores();
  seedClientRow(stores, defaultClientRow());

  const trace = [];
  let threw = null;
  try {
    runWorkflow('09b_YTUMA_Phone_Inbound_Receptionist', {
      body: { To: '+15551230000', From: '+13175559999', SpeechResult: 'I want to schedule a showing for Saturday', Confidence: '0.91' }
    }, stores, trace, '', 'Handle - Phone Gather');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow ran without throwing');
  ok &= assert(stores.brainLog.length === 1 && stores.brainLog[0].input.client_id === 'test-client', 'Brain was called with the correct client_id, resolved from the number dialed (not passed explicitly by the caller)');
  ok &= assert(/schedule a showing/.test(stores.brainLog[0].input.prompt), 'Brain was given the actual caller speech, not a placeholder');
  const resp = stores.webhookResponses[0];
  ok &= assert(!!resp && /<Say/.test(resp.body), 'a spoken TwiML reply was produced');
  const rows = crmRows(stores);
  const row = rows.find(r => r.contact_phone === '+13175559999');
  ok &= assert(!!row, 'an Interactions row was logged for the caller');
  ok &= assert(row && row.direction === 'inbound' && row.channel === 'phone', 'CRM row correctly tagged phone/inbound');
  ok &= assert(row && row.client_id === 'test-client', 'CRM row tagged with the correct client_id');
  ok &= assert(row && /schedule a showing/.test(row.full_message), 'CRM row captured the actual caller speech');
  console.log(ok ? '=> SCENARIO E: PASS\n' : '=> SCENARIO E: FAIL\n');
}

// ---------------------------------------------------------------
console.log('=== SCENARIO F: call to a number with NO matching client row (greeting step) ===');
{
  const stores = freshStores();
  // no registry rows seeded at all

  const trace = [];
  let threw = null;
  try {
    runWorkflow('09b_YTUMA_Phone_Inbound_Receptionist', {
      body: { To: '+19995550000', From: '+13175559999' }
    }, stores, trace, '', 'Start - Phone Inbound');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow degrades gracefully instead of throwing an unhandled error');
  const resp = stores.webhookResponses[0];
  ok &= assert(!!resp, 'a TwiML response was still produced for the caller');
  ok &= assert(resp && /Hangup/.test(resp.body) && !/Test Client Co/.test(resp.body), 'caller gets a polite generic message and a hangup, not a fabricated client name or a crash');
  const errLogKey = Object.keys(stores.sheets).find(k => k.startsWith('YTUMA_OBSERVABILITY_SHEET_ID::Error_Log'));
  ok &= assert(!!errLogKey && stores.sheets[errLogKey].length === 1, 'the wrong-number event was logged to Error_Log so you actually notice a number is misconfigured');
  console.log(ok ? '=> SCENARIO F: PASS\n' : '=> SCENARIO F: FAIL\n');
}

// ---------------------------------------------------------------
console.log('=== SCENARIO G: same, but at the gather step (speech already collected) ===');
{
  const stores = freshStores();
  const trace = [];
  let threw = null;
  try {
    runWorkflow('09b_YTUMA_Phone_Inbound_Receptionist', {
      body: { To: '+19995550000', From: '+13175559999', SpeechResult: 'hello?', Confidence: '0.8' }
    }, stores, trace, '', 'Handle - Phone Gather');
  } catch (err) { threw = err; }

  console.log(trace.join('\n'));
  if (threw) console.log('  EXCEPTION: ' + threw.stack);

  let ok = true;
  ok &= assert(!threw, 'workflow degrades gracefully instead of throwing an unhandled error');
  ok &= assert(stores.brainLog.length === 0, 'the Brain is never called for a call with no resolvable client (nothing to personalize with anyway)');
  const rows = crmRows(stores);
  ok &= assert(rows.length === 0, "nothing gets logged to a CRM sheet, since which client's sheet would it even be?");
  const resp = stores.webhookResponses[0];
  ok &= assert(!!resp && /trouble connecting/.test(resp.body), 'caller gets a polite generic message instead of a crash');
  console.log(ok ? '=> SCENARIO G: PASS\n' : '=> SCENARIO G: FAIL\n');
}
