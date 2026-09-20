/* CivicLens - Grievance awareness library (plain-language, India-relevant, generic escalation paths) */
(function () {
  'use strict';
  const U = CL.utils;

  const LIBRARY = [
    {
      category: 'roads', name: 'Roads and potholes',
      causes: [
        'Heavy monsoon rain weakening the road base', 'Wear and tear beyond the road design life',
        'Utility trenching (water/sewer lines) not restored properly', 'Overloaded vehicles on residential streets'
      ],
      department: 'Municipal roads and engineering wing (via the ward office)',
      timeline: 'Pothole patching is usually a quick fix (days to about 2 weeks); full resurfacing depends on the annual works calendar.',
      escalation: [
        'Ward office / ward engineer - first point of escalation',
        'Municipal helpline or official civic app - get a complaint number and track it',
        "Municipal commissioner's public grievance cell - if there is no response within the stated timeline",
        'Nothing in CivicLens replaces these channels - it only helps you understand patterns'
      ],
      tips: 'Photograph the pothole with a landmark and geo-location before reporting through the official app; repeated reports of the same spot may already be captured as one issue.'
    },
    {
      category: 'streetlights', name: 'Streetlights',
      causes: [
        'Bulb/LED failure at end of life', 'Faulty photocell or timer switches',
        'Cable or underground joint faults', 'Storm damage to poles or wiring'
      ],
      department: 'Municipal electrical wing, or the local electricity distribution company where street lighting is delegated.',
      timeline: 'Single lamp repairs are often fast (a few days); pole replacement after storms can take weeks.',
      escalation: [
        'Ward-level electrical staff via the ward office',
        'Municipal helpline / official app (mention the pole number if visible)',
        "Electricity distributor's complaint line for pole or feeder faults",
        'Report exposed wires or sparking IMMEDIATELY by phone - treat it as an emergency, not a routine complaint'
      ],
      tips: 'A pole/painting number dramatically speeds up repair. If a light flickers, note the time pattern - it helps identify a faulty switch or loose joint.'
    },
    {
      category: 'water', name: 'Water supply',
      causes: [
        'Pipeline leaks or bursts', 'Summer demand exceeding supply schedules',
        'Pump or valve failures', 'Sediment disturbance after pipeline repairs'
      ],
      department: 'Municipal water supply and sewerage board / department.',
      timeline: 'Pressure and scheduling issues may resolve in days; pipeline bursts depend on repair gangs; contamination reports are treated as priority.',
      escalation: [
        'Area water works office / valve man',
        'Water board helpline or official app',
        'Health department - if you suspect contamination (discoloured/odorous water, illness in the street)',
        'Keep a record of dates and supply hours - patterns help officials more than anger'
      ],
      tips: 'Store some water as a household buffer during repair windows. Boil or filter water after any pipeline work in your street. Never drink from a line mixed with sewage - report it at once.'
    },
    {
      category: 'sanitation', name: 'Garbage and sanitation',
      causes: [
        'Missed collection routes', 'Overflowing or too few bins',
        'Informal dumping spots that never got formalised or cleared', 'Shortage of sweepers or vehicles'
      ],
      department: 'Municipal health and sanitation wing (solid waste management).',
      timeline: 'Missed pickup complaints often clear in 1-3 days; removing legacy dumping points is a longer campaign.',
      escalation: [
        'Ward sanitation inspector / supervisor',
        'Municipal helpline or app with the bin location',
        'Ward committee meetings - a good place to raise recurring issues',
        'Segregation and fixed collection times are usually notified by the municipality - check the official notice first'
      ],
      tips: 'Wet/dry segregation reduces overflow. Reporting the same overflowing spot with photos over several days (with complaint numbers) builds a paper trail for escalation.'
    },
    {
      category: 'drainage', name: 'Drainage and sewage',
      causes: [
        'Clogging with plastic, silt and construction debris', 'Monsoon overload of storm drains',
        'Broken or undersized drain lines', 'Missing covers over chambers'
      ],
      department: 'Municipal drainage / sewerage wing; storm drains may sit with the roads wing.',
      timeline: 'Machine desilting of a blocked drain can take days to a couple of weeks; missing covers are a quick, high-priority fix.',
      escalation: [
        'Ward office for blockages and missing covers',
        'Municipal helpline / app for recurring overflow points',
        'Report open manholes as safety hazards immediately by phone, not just by app',
        'Pre-monsoon desilting is usually scheduled - ask the ward office for the schedule rather than waiting for a blockage'
      ],
      tips: 'Clear the area around an overflowing chamber and keep children away. Note which rains trigger the overflow (light vs heavy) - that detail helps engineers identify capacity vs blockage.'
    },
    {
      category: 'encroachment', name: 'Encroachment',
      causes: [
        'Vending or parking occupying footpaths and roads', 'Construction material stored on public space',
        'Structures slowly extending beyond sanctioned limits', 'Hoarding and signage beyond permissions'
      ],
      department: 'Municipal town planning / encroachment removal wing, sometimes with police support.',
      timeline: 'Removal drives depend on notices, hearings and court directions - expect this to be the slowest category.',
      escalation: [
        'Ward office written complaint (keep a copy)',
        "Municipal commissioner's grievance cell",
        'Right to Information (RTI) applications to ask what action was taken on a specific complaint',
        'Civic/volunteer groups can help document, but action rests with municipal authorities'
      ],
      tips: 'Photograph with date-stamps and landmarks. Encroachment complaints succeed on documentation, not volume - one clear, well-evidenced complaint beats twenty vague ones.'
    },
    {
      category: 'noise', name: 'Noise',
      causes: [
        'Loudspeakers beyond permitted hours or decibel limits', 'Construction at night',
        'Industrial generators without acoustic enclosures', 'Modified vehicle silencers'
      ],
      department: 'Police (noise is largely a policing matter under noise-pollution rules), with pollution control boards for industrial sources.',
      timeline: 'Loudspeaker and night-work complaints can get a same-day response; proving a recurring source takes log-keeping.',
      escalation: [
        'Local police station helpline for ongoing nuisance at night',
        'Pollution control board for generators, factories and construction sites',
        'Municipal licence wing for event permissions',
        'A sound-level meter app gives indicative readings, but official measurement is done by the authorities'
      ],
      tips: 'Note dates, times and durations in a simple log. If a festival is involved, speaking to organisers early is usually more effective than complaints on the day.'
    },
    {
      category: 'other', name: 'Other civic issues',
      causes: [
        'Stray animal management gaps', 'Damaged public amenities (benches, toilets, signage)',
        'Fallen trees and storm debris', 'Anything that does not fit the main categories'
      ],
      department: 'Varies widely: animal husbandry wing or NGOs for strays, parks wing for amenities, forest/gardens department for trees.',
      timeline: 'Highly variable - safety hazards (fallen cables, open pits) are treated urgently; amenity repairs follow routine budgets.',
      escalation: [
        'Ward office is the best first stop to identify the right department',
        'Municipal helpline / official app, then track the complaint number',
        'For hazards affecting safety, phone the control room rather than waiting for an app response'
      ],
      tips: 'When unsure which department owns a problem, describe the situation (not the solution you assume) to the ward office and let them route it.'
    }
  ];

  function card(item) {
    const initials = item.name.split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join('');
    return '<article class="card lib-card">' +
      '<h3><span class="lib-icon" style="background:' + U.CAT_COLORS[item.category] + '">' + initials + '</span>' + U.escapeHtml(item.name) + '</h3>' +
      '<div class="lib-section"><strong>Common causes</strong><ul>' +
      item.causes.map((c) => '<li>' + U.escapeHtml(c) + '</li>').join('') + '</ul></div>' +
      '<div class="lib-section"><strong>Typically handled by</strong><br>' + U.escapeHtml(item.department) + '</div>' +
      '<div class="lib-section"><strong>Expected timeline</strong><br>' + U.escapeHtml(item.timeline) + '</div>' +
      '<div class="lib-section"><strong>How to escalate (official channels)</strong><ul>' +
      item.escalation.map((c) => '<li>' + U.escapeHtml(c) + '</li>').join('') + '</ul></div>' +
      '<div class="lib-section"><strong>Citizen tip</strong><br>' + U.escapeHtml(item.tips) + '</div>' +
      '</article>';
  }

  function render() {
    const q = (document.getElementById('libSearch').value || '').toLowerCase().trim();
    const items = LIBRARY.filter((it) => {
      if (!q) return true;
      return (it.name + ' ' + it.category + ' ' + it.causes.join(' ') + ' ' + it.department + ' ' + it.tips).toLowerCase().includes(q);
    });
    document.getElementById('libGrid').innerHTML =
      items.map(card).join('') ||
      '<article class="card"><p class="muted">No library entries match your search.</p></article>';
  }

  document.getElementById('libSearch').addEventListener('input', render);
  if (window.CLApp) CLApp.register('library', render);
})();
