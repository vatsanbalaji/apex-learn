'use strict';
// Module content. Every module follows the same loop (Learn -> Try -> Results ->
// Explain -> Reflect -> Retry) and is rendered by the shared engine in app.js.
// All simulations are hypothetical/illustrative teaching tools, not predictions.
// Numeric claims are rounded and sourced in each module's `sources` list.

const SRC = {
  invGovCompound: { t: 'SEC Investor.gov - Compound Interest Calculator', u: 'https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator' },
  invGovAlloc: { t: 'SEC Investor.gov - Beginners’ Guide to Asset Allocation, Diversification, and Rebalancing', u: 'https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset' },
  dfaAverage: { t: 'Dimensional - The Uncommon Average: Long-Term Context on Annual Returns', u: 'https://www.dimensional.com/us-en/insights/the-uncommon-average' },
  dfaVol: { t: 'Dimensional - Recent Market Volatility', u: 'https://www.dimensional.com/ca-en/insights/recent-market-volatility' },
  tk92: { t: 'Tversky & Kahneman (1992), Advances in Prospect Theory, Journal of Risk and Uncertainty 5, 297-323', u: 'https://doi.org/10.1007/BF00122574' },
  bo00: { t: 'Barber & Odean (2000), Trading Is Hazardous to Your Wealth, Journal of Finance 55(2)', u: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=219228' },
};

const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtPct = (n, d = 1) => (n >= 0 ? '+' : '') + n.toFixed(d) + '%';

window.MODULES = {
// ───────────────────────────────────────────────── 1
'investing-basics': {
  title: 'Investing Basics',
  learn: [
    { h: 'What investing is', p: 'Investing means putting money into something (like companies, bonds, or funds) hoping it grows over time. A <b>stock</b> is a small piece of ownership in a company. A <b>bond</b> is a loan you make to a company or government that pays interest. A <b>fund</b> (like an ETF) bundles many investments into one.' },
    { h: 'Why time matters: compounding', p: '<b>Compound growth</b> means you earn returns on your earlier returns, not just on what you put in. It starts slowly, then speeds up. That is why <i>when</i> you start can matter as much as <i>how much</i> you put in.' },
    { h: 'A quick mental shortcut', p: 'The <b>Rule of 72</b>: divide 72 by a yearly growth rate to estimate how many years it takes money to double. At 8% per year, that is about 72 ÷ 8 = 9 years. It is an approximation, not a promise.' },
  ],
  try: {
    type: 'sliders', title: 'Grow your money (hypothetical)', intro: 'Set the starting amount, what you add each month, a yearly growth rate to <i>assume</i>, and how long you invest.',
    controls: [
      { k: 'start', label: 'Start', min: 0, max: 5000, step: 100, val: 1000, f: v => fmt$(v) },
      { k: 'monthly', label: 'Monthly', min: 0, max: 500, step: 10, val: 50, f: v => fmt$(v) },
      { k: 'rate', label: 'Rate / yr', min: 0, max: 10, step: 0.5, val: 7, f: v => v + '%' },
      { k: 'years', label: 'Years', min: 1, max: 40, step: 1, val: 20, f: v => v + 'y' },
    ],
    run(v) {
      const r = v.rate / 100 / 12, n = v.years * 12; let bal = v.start;
      for (let i = 0; i < n; i++) bal = bal * (1 + r) + v.monthly;
      const put = v.start + v.monthly * n;
      return { ...v, end: bal, put, growth: bal - put, double: v.rate > 0 ? 72 / v.rate : null };
    },
  },
  results: r => `<div class="grid"><div class="stat"><label>You put in</label><div class="v">${fmt$(r.put)}</div></div><div class="stat"><label>Growth earned</label><div class="v pos">${fmt$(r.growth)}</div></div><div class="stat"><label>Ending value</label><div class="v">${fmt$(r.end)}</div></div></div>
    <p class="muted">${r.double ? `At ${r.rate}%, the Rule of 72 says money doubles about every ${r.double.toFixed(1)} years.` : 'At 0% growth, nothing doubles. Your balance only equals what you put in.'}</p>`,
  explain: r => [
    r.growth > r.put
      ? `Notice that growth (${fmt$(r.growth)}) is now bigger than what you put in (${fmt$(r.put)}). That is compounding: your earlier gains started earning their own gains.`
      : `Here, growth (${fmt$(r.growth)}) is smaller than what you put in (${fmt$(r.put)}). Try adding more years or a higher rate and watch the gap flip. Time is the lever that makes compounding bigger.`,
    'The growth rate here is an <b>assumption you chose</b>, not a forecast. Real investments go up and down, and returns are never guaranteed. U.S. stocks have averaged roughly 10% a year since 1926 before inflation (about 7% after), but with big swings along the way.',
  ],
  reflect: ['If you could change only one slider (start, monthly, rate, or years), which would help most, and why?', 'What is one thing you could realistically do in the next year to put compounding to work?'],
  sources: [SRC.invGovCompound, SRC.dfaAverage],
},
// ───────────────────────────────────────────────── 2
'risk-and-return': {
  title: 'Risk and Return',
  learn: [
    { h: 'Return is what you get. Risk is how bumpy the ride is.', p: '<b>Return</b> is how much an investment grows or shrinks. <b>Risk</b>, in investing, mostly means how widely returns can swing, including the chance of losing money.' },
    { h: 'The trade-off', p: 'Investments that have historically offered higher average returns, like stocks, have also had bigger drops. Safer options, like cash and high-quality bonds, usually swing less but have historically grown less over long periods.' },
    { h: 'Averages hide the swings', p: 'U.S. stocks averaged about 10% a year over the long run, but a typical year rarely looks “average.” One analysis counted losing years in roughly one of every four calendar years, and the worst calendar year was about −44% (1931).' },
  ],
  try: {
    type: 'allocation', title: 'Pick your mix', intro: 'You have a simulated $10,000. Split it across stocks, bonds, and cash (must total 100%), then see how it would do in three <i>hypothetical</i> years.',
    assets: [{ k: 'Stocks', c: '#00e676' }, { k: 'Bonds', c: '#4da3ff' }, { k: 'Cash', c: '#9a9a9a' }],
    start: { Stocks: 60, Bonds: 30, Cash: 10 },
    scenarios: [
      { id: 'strong', label: 'Strong year', m: { Stocks: 26, Bonds: 5, Cash: 3.5 } },
      { id: 'typical', label: 'Typical year', m: { Stocks: 10, Bonds: 5, Cash: 3 } },
      { id: 'rough', label: 'Rough year', m: { Stocks: -25, Bonds: 2, Cash: 3 } },
    ],
    runAll(w, sc) {
      const out = sc.map(s => ({ label: s.label, pct: Object.keys(w).reduce((a, k) => a + (w[k] / 100) * s.m[k], 0) }));
      return { w, out, best: Math.max(...out.map(o => o.pct)), worst: Math.min(...out.map(o => o.pct)) };
    },
  },
  results: r => `<p class="muted">Your mix: ${Object.entries(r.w).filter(e => e[1] > 0).map(e => e[0] + ' ' + e[1] + '%').join(' · ')}</p>` +
    r.out.map(o => `<div class="bar"><span class="lbl">${o.label}</span><span class="b" style="width:${Math.min(Math.abs(o.pct) * 3, 220)}px;background:${o.pct >= 0 ? 'var(--green)' : 'var(--red)'}"></span><span class="num ${o.pct >= 0 ? 'pos' : 'neg'}">${fmtPct(o.pct)} (${fmt$(10000 * (1 + o.pct / 100))})</span></div>`).join('') +
    `<p class="muted" style="margin-top:10px">Spread between your best and worst year: <b>${(r.best - r.worst).toFixed(1)} points</b>. These three years are made-up examples for learning.</p>`,
  explain: r => [
    r.w.Stocks >= 70 ? 'With most of your money in stocks, your good year was great and your rough year was painful. That wide spread <i>is</i> the risk. It is also where the higher long-run growth has come from.'
      : r.w.Stocks <= 30 ? 'With little in stocks, your rough year barely hurt, but your strong year was modest. You traded away upside to get a smoother ride, and over decades that can mean noticeably less growth.'
      : 'A middle mix gives a middle result: you give up some upside in strong years and soften the damage in rough ones. There is no single “correct” mix. It depends on your goal and how soon you will need the money.',
    'The SEC notes the right mix depends largely on your <b>time horizon</b> (when you need the money) and your <b>risk tolerance</b> (how much of a drop you could live with without panicking).',
  ],
  reflect: ['Which of the three years bothered you most when you saw your result, and what does that tell you about your own comfort with risk?', 'Would your mix change if you needed this money in 2 years instead of 20? Why?'],
  sources: [SRC.invGovAlloc, SRC.dfaAverage],
},
// ───────────────────────────────────────────────── 3
'diversification': {
  title: 'Diversification',
  learn: [
    { h: 'Don’t bet it all on one thing', p: '<b>Diversification</b> means spreading your money across different investments so that no single company, sector, or asset type can sink your whole portfolio.' },
    { h: 'What it does and doesn’t do', p: 'Diversification does not remove risk or guarantee profit. It reduces the chance that one bad outcome dominates your results. Assets that do not all move together smooth out the ride.' },
    { h: 'Concentration cuts both ways', p: 'A portfolio packed into one area can win big when that area soars and lose big when it falls. The point of diversifying is to avoid needing to be right about one thing.' },
  ],
  try: {
    type: 'allocation', title: 'Build a portfolio', intro: 'Spread a simulated $10,000 across these assets (must total 100%), then test it against a <i>hypothetical</i> market event.',
    assets: [{ k: 'AAPL' }, { k: 'MSFT' }, { k: 'NVDA' }, { k: 'SPY' }, { k: 'TLT' }, { k: 'GLD' }, { k: 'XLE' }, { k: 'SOXL' }],
    note: 'AAPL, MSFT, NVDA: big tech stocks · SPY: broad U.S. stock market fund · TLT: long-term government bond fund · GLD: gold · XLE: energy stocks · SOXL: a 3× leveraged chip fund (extra volatile)',
    start: { AAPL: 40, MSFT: 30, NVDA: 30, SPY: 0, TLT: 0, GLD: 0, XLE: 0, SOXL: 0 },
    scenarios: [
      { id: 'tech', label: 'Tech selloff', pick: true, m: { AAPL: -18, MSFT: -15, NVDA: -28, SPY: -6, TLT: 4, GLD: 5, XLE: 2, SOXL: -55 } },
      { id: 'energy', label: 'Energy shock', pick: true, m: { AAPL: -2, MSFT: -1, NVDA: -3, SPY: -2, TLT: 1, GLD: 3, XLE: 22, SOXL: -6 } },
      { id: 'rally', label: 'Broad rally', pick: true, m: { AAPL: 8, MSFT: 7, NVDA: 14, SPY: 5, TLT: -2, GLD: -1, XLE: 4, SOXL: 30 } },
    ],
    runAll(w, sc, pick) {
      const s = sc.find(x => x.id === pick) || sc[0];
      const pct = Object.keys(w).reduce((a, k) => a + (w[k] / 100) * (s.m[k] || 0), 0);
      const keys = Object.keys(s.m), bench = keys.reduce((a, k) => a + s.m[k], 0) / keys.length;
      const hhi = Object.values(w).reduce((a, v) => a + Math.pow(v / 100, 2), 0);
      const effective = hhi > 0 ? 1 / hhi : 0;
      return { w, scenario: s.label, pct, bench, hhi, top: Math.max(...Object.values(w)), effective, out: [{ label: 'Your portfolio', pct }, { label: 'Equal-weight mix', pct: bench }] };
    },
  },
  results: r => `<p class="muted">Scenario: <b>${r.scenario}</b></p>` +
    r.out.map(o => `<div class="bar"><span class="lbl">${o.label}</span><span class="b" style="width:${Math.min(Math.abs(o.pct) * 3, 220)}px;background:${o.pct >= 0 ? 'var(--green)' : 'var(--red)'}"></span><span class="num ${o.pct >= 0 ? 'pos' : 'neg'}">${fmtPct(o.pct)}</span></div>`).join('') +
    `<div class="grid" style="margin-top:12px"><div class="stat"><label>Biggest position</label><div class="v">${r.top}%</div></div><div class="stat"><label>Effective # of holdings</label><div class="v">${r.effective.toFixed(1)}</div></div><div class="stat"><label>Your $10,000 became</label><div class="v ${r.pct >= 0 ? 'pos' : 'neg'}">${fmt$(10000 * (1 + r.pct / 100))}</div></div></div>`,
  explain: r => [
    r.top >= 50 ? `${r.top}% of your portfolio sat in a single holding, and you effectively held only about ${r.effective.toFixed(1)} independent positions. Your result was pulled hard toward that one holding’s fate.`
      : `Your biggest position was ${r.top}% and you effectively held about ${r.effective.toFixed(1)} positions, so no single asset could dominate. Your result tracked the broader mix more closely.`,
    'Try the other two scenarios with the <i>same</i> portfolio. A concentrated portfolio often looks brilliant in one scenario and dreadful in another. A diversified one rarely looks as extreme in either. Note that diversification does not protect you from a broad market decline, since many assets can fall together.',
  ],
  reflect: ['What would you change about your allocation next time, and why?', 'Was there a moment you wanted to put more into one asset? What pulled you toward it?'],
  sources: [SRC.invGovAlloc],
},
// ───────────────────────────────────────────────── 4
'market-volatility': {
  title: 'Market Volatility',
  learn: [
    { h: 'Prices move. That is normal.', p: '<b>Volatility</b> is how much and how fast prices move. Even in good years, markets drop along the way: the S&P 500 has typically fallen about 14% at some point within a calendar year.' },
    { h: 'Most years still end up', p: 'Despite those dips, U.S. stocks finished up in roughly three of every four calendar years. A drop is common. A drop that is permanent has not been the historical pattern for broad markets, but there is no guarantee it never will be.' },
    { h: 'Your reaction is the real risk', p: 'A temporary decline only becomes a real loss when you sell it. Many investors lose the most not from the drop itself but from reacting to it.' },
  ],
  try: {
    type: 'dip', title: 'The dip', intro: 'Below is a <i>hypothetical</i> index you own $10,000 of. It started at 100, climbed, then fell. You are standing at the bottom of the drop. What do you do?',
    path: [100, 102, 105, 107, 110, 112, 108, 103, 98, 93, 89, 86],
    future: [88, 91, 90, 94, 97, 99, 98, 101, 103, 104],
    choices: [
      { id: 'sell', label: 'Sell everything and wait in cash', note: 'Lock in what is left.' },
      { id: 'hold', label: 'Hold and do nothing', note: 'Ride it out.' },
      { id: 'buy', label: 'Hold and add $2,000 more', note: 'Buy while prices are lower.' },
    ],
    run(choice, path, future) {
      const bottom = path[path.length - 1], endP = future[future.length - 1], peak = Math.max(...path), shares = 100;
      const sell = shares * bottom, hold = shares * endP, buy = (shares + 2000 / bottom) * endP;
      return { choice, bottom, endP, drop: (bottom / peak - 1) * 100, sell, hold, buy, mine: { sell, hold, buy }[choice] };
    },
  },
  results: r => `<div class="grid"><div class="stat"><label>Drop from peak</label><div class="v neg">${r.drop.toFixed(0)}%</div></div><div class="stat"><label>Your choice</label><div class="v">${{ sell: 'Sell', hold: 'Hold', buy: 'Add' }[r.choice]}</div></div><div class="stat"><label>You ended with</label><div class="v ${r.mine >= 10000 ? 'pos' : 'neg'}">${fmt$(r.mine)}</div></div></div>
    <div class="bar"><span class="lbl">Sold at bottom</span><span class="b" style="width:${r.sell / 60}px;background:var(--red)"></span><span class="num">${fmt$(r.sell)}</span></div>
    <div class="bar"><span class="lbl">Held</span><span class="b" style="width:${r.hold / 60}px;background:var(--green)"></span><span class="num">${fmt$(r.hold)}</span></div>
    <div class="bar"><span class="lbl">Held + added $2k</span><span class="b" style="width:${r.buy / 60}px;background:var(--green)"></span><span class="num">${fmt$(r.buy)}</span></div>`,
  explain: r => [
    'In this example the index recovered, so holding beat selling, and adding money did best. That is <b>hindsight</b>: when you stand at the bottom, you cannot see the recovery. It felt like it might keep falling.',
    'Real markets do not promise recoveries on a schedule, and individual stocks can fall and never return. What history does suggest for broad, diversified investments is that the people who suffer most are often the ones who sold in a panic and missed the rebound. Having money you will not need for years, and a plan made <i>before</i> the drop, is what makes staying calm possible.',
  ],
  reflect: ['What did you feel when you saw the drop, and what did you choose because of that feeling?', 'What plan could you write down today so you are not deciding in the middle of a scary drop?'],
  sources: [SRC.dfaVol, SRC.dfaAverage],
},
// ───────────────────────────────────────────────── 5
'behavioral-biases': {
  title: 'Behavioral Biases',
  learn: [
    { h: 'Smart people make predictable mistakes', p: 'Behavioral finance studies how emotions and mental shortcuts push us toward choices that do not match our own goals. These patterns are called <b>biases</b>, and everyone has them.' },
    { h: 'A few to watch for', p: '<b>Loss aversion</b>: a loss hurts more than an equal gain feels good (studies estimate roughly twice as much). <b>Anchoring</b>: fixating on a number, like the price you paid. <b>Herd behavior</b>: following the crowd. <b>Overconfidence</b>: overrating what you know. <b>Recency bias</b>: assuming the recent past will continue.' },
    { h: 'No judgment', p: 'Seeing a bias in yourself is not a failure. It is the first step to building habits and rules that protect you from it.' },
  ],
  try: {
    type: 'choices', title: 'Five quick decisions', intro: 'Answer honestly. There are no right answers here, and your answers are only used to show you your own patterns.',
    qs: [
      { q: 'A coin flip: heads you win $150, tails you lose $100. Would you take it?', o: [{ t: 'Yes, take it', b: null }, { t: 'No, pass', b: 'loss' }] },
      { q: 'You bought a stock at $100. It is now $60 and the company’s outlook has worsened. What is your thinking?', o: [{ t: 'I will hold until it gets back to $100', b: 'anchor' }, { t: 'I will decide based on what it looks worth from here, not what I paid', b: null }] },
      { q: 'A coin everyone is talking about is up 40% this week. All your friends bought in. You...', o: [{ t: 'Buy now before it goes higher', b: 'herd' }, { t: 'Skip it or research first', b: null }] },
      { q: 'You pick 10 stocks. How many do you expect to beat the market?', o: [{ t: '7 or more', b: 'over' }, { t: 'About 5', b: null }, { t: 'Fewer than 5', b: null }] },
      { q: 'The market has risen three years in a row. What do you expect next year?', o: [{ t: 'More of the same. The trend will continue', b: 'recent' }, { t: 'It could go either way. I cannot know', b: null }] },
    ],
    names: { loss: 'Loss aversion', anchor: 'Anchoring', herd: 'Herd behavior', over: 'Overconfidence', recent: 'Recency bias' },
    run(ans, t) { const hit = ans.filter(b => b).map(b => t.names[b]); return { hit, n: ans.length }; },
  },
  results: r => `<div class="grid"><div class="stat"><label>Patterns spotted</label><div class="v">${r.hit.length} / ${r.n}</div></div></div>` +
    (r.hit.length ? '<p>You leaned toward: ' + r.hit.map(h => `<b>${h}</b>`).join(', ') + '.</p>' : '<p>None of your answers leaned toward the five biases here. Nice, though real-life decisions with real stakes and emotions are harder than a quiz.</p>'),
  explain: r => [
    r.hit.includes('Loss aversion') ? 'Declining that coin flip is common. The flip has a positive expected value (on average you would gain), but a $100 loss feels bigger than a $150 win feels good. Research by Tversky and Kahneman estimates losses weigh roughly 2.25× as much as gains, though the exact size varies by person and situation.' : 'Loss aversion shows up when people refuse good bets to avoid feeling a loss. Studies estimate losses feel roughly twice as strong as equal gains, though it varies.',
    'Bias is not just trivia. A well-known study of tens of thousands of brokerage accounts (Barber and Odean) found that the investors who traded the most earned noticeably lower returns after costs than those who traded least, and the authors link much of that to overconfidence.',
    'Defenses that work: decide your rules <i>before</i> emotions hit, write down why you are buying or selling, and wait a day before acting on a hot tip.',
  ],
  reflect: ['Which question made you hesitate, and what was going through your head?', 'Pick one bias from today. What is one simple rule you could set for yourself to guard against it?'],
  sources: [SRC.tk92, SRC.bo00],
},
// ───────────────────────────────────────────────── 6
'long-term-investing': {
  title: 'Long-Term Investing',
  learn: [
    { h: 'Time is the biggest advantage you have', p: 'The earlier you start, the longer compounding has to work. Starting even a few years later can cost far more than you would expect, even if you contribute the same amount each month afterward.' },
    { h: 'Short-term noise, long-term pattern', p: 'Over a single year, stocks can swing wildly. Over decades, broad U.S. stocks have historically grown substantially, though never in a straight line and never with a guarantee.' },
    { h: 'Your horizon shapes your choices', p: 'Money needed in a few years generally belongs in steadier places, because there is little time to recover from a drop. Money for goals decades away can usually afford more ups and downs.' },
  ],
  try: {
    type: 'sliders', title: 'The cost of waiting (hypothetical)', intro: 'You plan to invest for a 40-year horizon. Compare starting today with waiting. The rate is an assumption, not a forecast.',
    controls: [
      { k: 'monthly', label: 'Monthly', min: 25, max: 1000, step: 25, val: 200, f: v => fmt$(v) },
      { k: 'wait', label: 'Wait', min: 0, max: 15, step: 1, val: 10, f: v => v + 'y' },
      { k: 'rate', label: 'Rate / yr', min: 3, max: 10, step: 0.5, val: 7, f: v => v + '%' },
    ],
    run(v) {
      const sim = yrs => { let b = 0; const r = v.rate / 100 / 12; for (let i = 0; i < yrs * 12; i++) b = b * (1 + r) + v.monthly; return b; };
      const early = sim(40), late = sim(40 - v.wait);
      return { ...v, early, late, lost: early - late, putEarly: v.monthly * 480, putLate: v.monthly * (40 - v.wait) * 12 };
    },
  },
  results: r => `<div class="bar"><span class="lbl">Start today</span><span class="b" style="width:${Math.max(4, r.early / Math.max(r.early, 1) * 220)}px;background:var(--green)"></span><span class="num">${fmt$(r.early)}</span></div>
    <div class="bar"><span class="lbl">Wait ${r.wait} years</span><span class="b" style="width:${Math.max(4, r.late / Math.max(r.early, 1) * 220)}px;background:var(--amber)"></span><span class="num">${fmt$(r.late)}</span></div>
    <div class="grid" style="margin-top:12px"><div class="stat"><label>Cost of waiting</label><div class="v neg">${fmt$(r.lost)}</div></div><div class="stat"><label>Extra you would put in</label><div class="v">${fmt$(r.putEarly - r.putLate)}</div></div></div>`,
  explain: r => [
    r.wait === 0 ? 'With no wait, both lines are the same. Slide “Wait” up and watch what a few years of delay does.' : `Waiting ${r.wait} years meant putting in ${fmt$(r.putEarly - r.putLate)} <i>less</i>, but you ended with ${fmt$(r.lost)} less. The money you invest early has the longest time to compound, so each early dollar does the most work.`,
    'This is a hypothetical with a steady rate. Real returns arrive unevenly, with losing years mixed in, and nothing is guaranteed. The lesson is not a number. It is that time in the market, plus consistency, is the lever you control most.',
  ],
  reflect: ['What is a goal you have that is 10 or more years away, and what would starting now change about it?', 'What would make it hard for you to keep investing steadily when markets drop, and how could you plan for that?'],
  sources: [SRC.invGovCompound, SRC.dfaAverage],
},
};
