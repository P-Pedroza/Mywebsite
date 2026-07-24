// Minimal n8n-workflow interpreter used to test the REAL committed JSON files
// (11_Email_Approval_Handler -> 12_Email_Sender -> 98_Retry_Engine -> 99_Error_Handler,
// plus 00_Client_Registry) against mocked external services, without a live n8n instance.
//
// This executes the actual node "parameters" (jsCode, assignments, conditions, expressions)
// straight out of the JSON files - it is not a re-implementation of intent, it is a runner
// for the committed logic.

const fs = require('fs');
const path = require('path');

function loadWorkflows(wfDir) {
  const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.json'));
  const byName = {};
  for (const f of files) {
    const wf = JSON.parse(fs.readFileSync(path.join(wfDir, f), 'utf8'));
    byName[wf.name] = wf;
  }
  return byName;
}

function nowMock() {
  const iso = '2026-07-25T12:00:00.000Z';
  return { toISO: () => iso, toISOString: () => iso };
}

function makeDollar(nodeOutputs) {
  return function (name) {
    const val = nodeOutputs[name];
    return { item: { json: val }, first: () => ({ json: val }) };
  };
}

function evalExprString(str, ctx) {
  if (typeof str !== 'string') return str;
  if (!str.startsWith('=')) return str;
  const body = str.slice(1);
  const trimmed = body.trim();
  const fullMatch = /^\{\{([\s\S]*)\}\}$/.exec(trimmed);
  const $ = makeDollar(ctx.nodeOutputs);
  const $json = ctx.json;
  const $now = nowMock();
  const $binary = ctx.binary || {};
  const $input = { all: () => (ctx.allItems || [{ json: $json }]) };
  if (fullMatch) {
    const inner = fullMatch[1];
    // eslint-disable-next-line no-new-func
    return new Function('$json', '$now', '$binary', '$', '$input', 'return (' + inner + ')')($json, $now, $binary, $, $input);
  }
  return body.replace(/\{\{([\s\S]*?)\}\}/g, (m, inner) => {
    // eslint-disable-next-line no-new-func
    const v = new Function('$json', '$now', '$binary', '$', '$input', 'return (' + inner + ')')($json, $now, $binary, $, $input);
    return v === undefined || v === null ? '' : String(v);
  });
}

function execSet(node, inputJson, nodeOutputs) {
  const ctx = { json: inputJson, nodeOutputs };
  const opts = node.parameters.options || {};
  const base = opts.keepOnlySet ? {} : { ...inputJson };
  for (const a of node.parameters.assignments.assignments) {
    base[a.name] = a.type === 'boolean' && typeof a.value === 'boolean' ? a.value : evalExprString(a.value, ctx);
  }
  return base;
}

function execCode(node, inputJson, nodeOutputs, trace) {
  const $ = makeDollar(nodeOutputs);
  const $json = inputJson;
  const $now = nowMock();
  const $binary = {};
  const $items = (name) => (nodeOutputs[name] ? [{ json: nodeOutputs[name] }] : []);
  const fakeThis = { getWorkflowStaticData: () => ({}) };
  // eslint-disable-next-line no-new-func
  const fn = new Function('$json', '$now', '$binary', '$', '$items', node.parameters.jsCode);
  const result = fn.call(fakeThis, $json, $now, $binary, $, $items);
  if (!result || !result[0]) { trace.push('  [code] ' + node.name + ' -> (no items, branch stops)'); return null; }
  return result[0].json;
}

function evalCondition(c, ctx) {
  const left = evalExprString(c.leftValue, ctx);
  const right = c.rightValue;
  const op = c.operator;
  if (op.type === 'boolean' && op.operation === 'true') return left === true;
  // n8n's "String" type conditions coerce null/undefined to '' before comparing -
  // matching that here, since $json.someMissingField is a very common real case.
  const leftStr = (left === undefined || left === null) ? '' : String(left);
  if (op.type === 'string' && op.operation === 'equals') return leftStr === right;
  if (op.type === 'string' && op.operation === 'notEquals') return leftStr !== right;
  if (op.type === 'string' && op.operation === 'regex') return new RegExp(right).test(leftStr);
  throw new Error('Unsupported operator: ' + JSON.stringify(op));
}

function evalIf(node, json, nodeOutputs) {
  const ctx = { json, nodeOutputs };
  return node.parameters.conditions.conditions.every(c => evalCondition(c, ctx));
}

function evalSwitch(node, json, nodeOutputs) {
  const ctx = { json, nodeOutputs };
  const rules = node.parameters.rules.values;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].conditions.conditions.every(c => evalCondition(c, ctx))) return i;
  }
  return rules.length;
}

function execGoogleSheets(node, inputJson, nodeOutputs, stores, trace) {
  const ctx = { json: inputJson, nodeOutputs };
  const p = node.parameters;
  const documentId = evalExprString(p.documentId.value, ctx);
  const sheetName = evalExprString(p.sheetName.value, ctx);
  const key = documentId + '::' + sheetName;
  if (!stores.sheets[key]) stores.sheets[key] = [];
  const table = stores.sheets[key];

  if (p.operation === 'lookup') {
    const filt = p.filtersUI.values[0];
    const val = evalExprString(filt.lookupValue, ctx);
    const found = table.find(r => String(r[filt.lookupColumn]) === String(val));
    trace.push(`  [sheets:lookup] ${key} where ${filt.lookupColumn}=${val} -> ${found ? 'FOUND' : 'not found'}`);
    return found ? { ...found } : {};
  }
  if (p.operation === 'append') {
    const row = {};
    for (const [k, v] of Object.entries(p.columns.value)) row[k] = evalExprString(v, ctx);
    table.push(row);
    trace.push(`  [sheets:append] ${key} <- ${JSON.stringify(row)}`);
    return row;
  }
  if (p.operation === 'appendOrUpdate' || p.operation === 'update') {
    const matchCols = p.columns.matchingColumns || [];
    const newVals = {};
    for (const [k, v] of Object.entries(p.columns.value)) newVals[k] = evalExprString(v, ctx);
    const existing = table.find(r => matchCols.length && matchCols.every(c => String(r[c]) === String(newVals[c])));
    if (existing) {
      Object.assign(existing, newVals);
      trace.push(`  [sheets:${p.operation}] ${key} UPDATED row matching ${matchCols.join(',')} -> ${JSON.stringify(newVals)}`);
      return existing;
    }
    table.push(newVals);
    trace.push(`  [sheets:${p.operation}] ${key} INSERTED -> ${JSON.stringify(newVals)}`);
    return newVals;
  }
  throw new Error('Unsupported sheets op: ' + p.operation);
}

function execGmail(node, inputJson, nodeOutputs, stores, trace) {
  const ctx = { json: inputJson, nodeOutputs };
  const p = node.parameters;
  const rec = {
    node: node.name,
    to: evalExprString(p.sendTo, ctx),
    subject: evalExprString(p.subject, ctx),
    message: evalExprString(p.message, ctx),
  };
  if (stores.gmailShouldFail) {
    trace.push(`  [gmail] ${node.name} SIMULATED FAILURE sending to ${rec.to}`);
    return { ...inputJson, error: 'Simulated Gmail API failure (invalid_grant)' };
  }
  stores.gmailLog.push(rec);
  trace.push(`  [gmail] ${node.name} SENT to=${rec.to} subject="${rec.subject}"`);
  return { ...inputJson };
}

function execTelegram(node, inputJson, nodeOutputs, stores, trace) {
  const ctx = { json: inputJson, nodeOutputs };
  const p = node.parameters;
  const rec = { node: node.name, chatId: evalExprString(p.chatId, ctx), text: evalExprString(p.text, ctx) };
  stores.telegramLog.push(rec);
  trace.push(`  [telegram] ${node.name} -> chat ${rec.chatId}: ${JSON.stringify(rec.text)}`);
  return inputJson;
}

function execute(node, inputJson, nodeOutputs, stores, trace) {
  switch (node.type) {
    case 'n8n-nodes-base.executeWorkflowTrigger':
    case 'n8n-nodes-base.telegramTrigger':
      return inputJson;
    case 'n8n-nodes-base.set':
      return execSet(node, inputJson, nodeOutputs);
    case 'n8n-nodes-base.code':
      return execCode(node, inputJson, nodeOutputs, trace);
    case 'n8n-nodes-base.if':
    case 'n8n-nodes-base.switch':
      return inputJson;
    case 'n8n-nodes-base.googleSheets':
      return execGoogleSheets(node, inputJson, nodeOutputs, stores, trace);
    case 'n8n-nodes-base.gmail':
      return execGmail(node, inputJson, nodeOutputs, stores, trace);
    case 'n8n-nodes-base.telegram':
      return execTelegram(node, inputJson, nodeOutputs, stores, trace);
    case 'n8n-nodes-base.wait':
      trace.push(`  [wait] ${node.name} (no-op in simulation)`);
      return inputJson;
    case 'n8n-nodes-base.executeWorkflow': {
      const ctx = { json: inputJson, nodeOutputs };
      const targetName = evalExprString(node.parameters.workflowId.value, ctx);
      const inputsParam = node.parameters.workflowInputs.value;
      let resolvedInput;
      if (typeof inputsParam === 'string') {
        resolvedInput = evalExprString(inputsParam, ctx);
      } else {
        resolvedInput = {};
        for (const [k, v] of Object.entries(inputsParam)) resolvedInput[k] = evalExprString(v, ctx);
      }
      trace.push(`  [call] ${node.name} -> ${targetName} with ${JSON.stringify(resolvedInput)}`);
      return runWorkflow(targetName, resolvedInput, stores, trace, '  ');
    }
    default:
      throw new Error('Unsupported node type in simulator: ' + node.type + ' (' + node.name + ')');
  }
}

function traverse(wf, nodesByName, nodeName, inputJson, nodeOutputs, stores, trace, indent) {
  const node = nodesByName[nodeName];
  trace.push(indent + '-> ' + nodeName + ' (' + node.type.split('.').pop() + ')');
  let outputJson;
  try {
    outputJson = execute(node, inputJson, nodeOutputs, stores, trace);
  } catch (err) {
    trace.push(indent + '  ERROR in ' + nodeName + ': ' + err.message);
    throw err;
  }
  nodeOutputs[nodeName] = outputJson;
  if (outputJson === null) return outputJson; // code node returned no items -> branch stops

  const conn = wf.connections[nodeName];
  if (!conn || !conn.main) return outputJson;

  let branchIndex = 0;
  if (node.type === 'n8n-nodes-base.if') branchIndex = evalIf(node, outputJson, nodeOutputs) ? 0 : 1;
  else if (node.type === 'n8n-nodes-base.switch') branchIndex = evalSwitch(node, outputJson, nodeOutputs);

  const targets = conn.main[branchIndex] || [];
  if (targets.length === 0) return outputJson;

  let last = outputJson;
  for (const t of targets) {
    last = traverse(wf, nodesByName, t.node, outputJson, nodeOutputs, stores, trace, indent);
  }
  return last;
}

let workflowsByName = {};

function setWorkflows(byName) {
  workflowsByName = byName;
}

function runWorkflow(workflowName, inputJson, stores, trace, indent) {
  const wf = workflowsByName[workflowName];
  if (!wf) throw new Error('Unknown workflow: ' + workflowName);
  const nodesByName = {};
  wf.nodes.forEach(n => { nodesByName[n.name] = n; });
  const trigger = wf.nodes.find(n => n.type === 'n8n-nodes-base.executeWorkflowTrigger' || n.type === 'n8n-nodes-base.telegramTrigger');
  const nodeOutputs = {};
  return traverse(wf, nodesByName, trigger.name, inputJson, nodeOutputs, stores, trace, indent || '');
}

module.exports = { loadWorkflows, setWorkflows, runWorkflow };
