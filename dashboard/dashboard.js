'use strict';

const $ = id => document.getElementById(id);
const state = { orders: [], inventory: [], approvals: [], filter: 'ALL', busy: false };
const descriptions = {
  overview: ['Overview', 'Your commerce operations, at a glance.'],
  inventory: ['Inventory', 'Products, stock levels and replenishment recommendations.'],
  approvals: ['Approvals', 'A human review step for every proposed action.'],
  agents: ['AI Workspace', 'Ask specialized agents for operational insights.'],
};

async function graphql(query, variables = {}) {
  const response = await fetch('/graphql', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error('GraphQL request failed (HTTP ' + response.status + ')');
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors[0].message || 'Request failed');
  return body.data;
}
function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = String(value);
  if (className) el.className = className;
  return el;
}
function clear(el) { el.replaceChildren(); }
function formatMoney(cents) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100); }
function badge(label, cls) { return text('span', label, 'status ' + cls); }
function cell(row, value, cls) { const td = text('td', value); if (cls) td.className = cls; row.append(td); return td; }
function showNotice(message, error = false) {
  const el = $('notice');
  el.textContent = message;
  el.className = 'notice' + (error ? ' error' : '');
  el.hidden = !message;
  if (message) setTimeout(() => { if (el.textContent === message) el.hidden = true; }, 6500);
}
function navigate(panel) {
  if (!descriptions[panel]) panel = 'overview';
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === panel));
  document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === panel));
  $('pageTitle').textContent = descriptions[panel][0];
  $('pageCrumb').textContent = descriptions[panel][0];
  $('pageDescription').textContent = descriptions[panel][1];
  if (location.hash !== '#' + panel) history.replaceState(null, '', '#' + panel);
}
function paintOrders() {
  const el = $('recentOrders'); clear(el);
  for (const order of state.orders.slice(0, 5)) {
    const tr = document.createElement('tr');
    cell(tr, '#' + order.id);
    cell(tr, formatMoney(order.totalCents));
    const td = document.createElement('td'); td.append(badge(order.status, order.status)); tr.append(td);
    el.append(tr);
  }
  if (!state.orders.length) {
    const tr = document.createElement('tr');
    const td = cell(tr, 'No orders found'); td.colSpan = 3; el.append(tr);
  }
}
function paintInventory() {
  const el = $('inventoryRows'); clear(el);
  for (const item of state.inventory) {
    const low = item.stockQuantity <= 10;
    const tr = document.createElement('tr');
    cell(tr, item.productName); cell(tr, item.sku); cell(tr, String(item.stockQuantity) + ' units');
    const health = document.createElement('td'); health.append(badge(low ? 'LOW STOCK' : 'HEALTHY', low ? 'PENDING' : 'APPROVED')); tr.append(health);
    const action = document.createElement('td'); action.className = 'align-right';
    if (low) {
      const b = text('button', 'Create proposal ↗', 'action-button');
      b.type = 'button';
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await graphql('mutation($sku:String!){recommendReplenishment(sku:$sku){id}}', { sku: item.sku });
          await refresh();
          showNotice('Replenishment proposal saved for human review.');
          navigate('approvals');
        } catch (error) { showNotice(error.message, true); }
        finally { b.disabled = false; }
      });
      action.append(b);
    } else action.append(text('span', 'No action needed', 'muted'));
    tr.append(action); el.append(tr);
  }
}
function paintApprovals() {
  const el = $('approvalCards'); clear(el);
  const proposals = state.approvals.filter(p => state.filter === 'ALL' || p.status === state.filter);
  if (!proposals.length) {
    const wrap = text('div', '', 'empty-state');
    wrap.append(text('strong', 'Nothing in this view'), text('span', 'Create a proposal from a low-stock item to see it here.'));
    el.append(wrap);
    return;
  }
  for (const item of proposals) {
    const card = text('article', '', 'approval-card');
    const body = document.createElement('div');
    body.append(text('h3', item.productName + ' · ' + item.recommendedQuantity + ' units'));
    body.append(text('p', item.reason));
    const meta = text('div', '', 'approval-meta');
    meta.append(text('span', 'SKU ' + item.sku), text('span', '·'), text('span', item.currentStock + ' currently in stock'), badge(item.status, item.status));
    body.append(meta); card.append(body);
    if (item.status === 'PENDING') {
      const buttons = text('div', '', 'approval-actions');
      for (const [decision, title, cls] of [['REJECTED','Reject','secondary-button'],['APPROVED','Approve','primary-button']]) {
        const b = text('button', title, cls); b.type = 'button';
        b.addEventListener('click', async () => {
          buttons.querySelectorAll('button').forEach(button => { button.disabled = true; });
          try {
            await graphql('mutation($id:ID!,$decision:ApprovalDecision!){reviewApproval(id:$id,decision:$decision){id status}}', { id: item.id, decision });
            await refresh();
            showNotice('Proposal ' + decision.toLowerCase() + '. No purchase order was created.');
          } catch (error) {
            showNotice(error.message, true);
            buttons.querySelectorAll('button').forEach(button => { button.disabled = false; });
          }
        });
        buttons.append(b);
      }
      card.append(buttons);
    }
    el.append(card);
  }
}
async function refresh() {
  try {
    const data = await graphql('query Dashboard { orders { id status totalCents } inventory { sku productName stockQuantity } approvalProposals { id sku productName currentStock recommendedQuantity reason status createdAt reviewedAt } }');
    state.orders = data.orders ?? [];
    state.inventory = data.inventory ?? [];
    state.approvals = data.approvalProposals ?? [];
    $('kpiOrders').textContent = state.orders.length;
    $('kpiProcessing').textContent = state.orders.filter(o => o.status === 'PROCESSING').length;
    $('kpiLowStock').textContent = state.inventory.filter(i => i.stockQuantity <= 10).length;
    const pending = state.approvals.filter(a => a.status === 'PENDING').length;
    $('kpiApprovals').textContent = pending; $('navPending').textContent = pending;
    paintOrders(); paintInventory(); paintApprovals();
  } catch (error) { showNotice('Could not load dashboard data. ' + error.message, true); }
}
async function runAgent(event) {
  event.preventDefault();
  if (state.busy) return;
  const question = $('agentQuestion').value.trim();
  if (!question) return;
  state.busy = true; $('runAgent').disabled = true; $('runAgent').textContent = 'Running…';
  const area = $('agentResponse'); clear(area); area.append(text('p', 'Waiting for the agent…'));
  try {
    const data = await graphql('mutation($question:String!,$route:AgentRoute){askCommerceAgent(question:$question,route:$route){route answer toolCalls events{type name detail}}}', {
      question, route: $('agentRole').value,
    });
    clear(area);
    const result = data.askCommerceAgent;
    area.append(text('div', result.answer, 'answer-text'));
    const trace = text('div', '', 'trace');
    trace.append(text('strong', result.route + ' · ' + result.toolCalls + ' tool call(s)'));
    for (const item of result.events) trace.append(text('div', item.type + (item.name ? ' · ' + item.name : '') + ' — ' + item.detail));
    area.append(trace);
  } catch (error) {
    clear(area); area.append(text('p', 'Agent request failed: ' + error.message));
    showNotice('AI call failed. Check that the API key is configured; requests can incur charges.', true);
  } finally { state.busy = false; $('runAgent').disabled = false; $('runAgent').textContent = 'Run AI agent ↗'; }
}
document.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault(); navigate(link.dataset.nav);
}));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
  paintApprovals();
}));
$('heroReview').addEventListener('click', () => navigate('approvals'));
$('refreshButton').addEventListener('click', () => void refresh());
$('agentForm').addEventListener('submit', event => { void runAgent(event); });
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
navigate(location.hash.slice(1) || 'overview');
void refresh();
