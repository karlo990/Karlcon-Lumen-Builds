/* KARLCON Lumen Builds — built-in concept catalogue.
   Shared by concepts.html (public) and developer.html (model generation).
   thumbUrl    = card image (full studio scene, 4:5)
   meshySource = cropped building on its own, sent to Meshy image-to-3D
   Numbers only appear where they come from the LB-1 engineering file. */
window.KC_CHANNELS = [
  { id: 'all',        no: '100', name: 'All channels' },
  { id: 'skylights',  no: '101', name: 'Skylights' },
  { id: 'pavilions',  no: '102', name: 'Pavilions' },
  { id: 'residences', no: '103', name: 'Residences' },
  { id: 'heritage',   no: '104', name: 'Heritage' },
  { id: 'shortlist',  no: '♥',   name: 'My shortlist' }
];

window.KC_SEED = [
  /* ---- CH 101 Skylights: the products ---- */
  { id: 'biparting-skylight', title: 'Bi-parting Hinged Skylight', channel: 'skylights', mechanism: 'hinged', featured: true, order: 1,
    tagline: 'Two glass leaves lift apart on paired actuators and open the roof from the centre — the reveal from our first campaign.',
    specs: [{ k: 'Aperture', v: '1.5 × 2.0 m' }, { k: 'Leaves', v: '2 × top-hung, bi-parting' }, { k: 'Lift', v: '555 N per actuator' }, { k: 'Wind hold', v: '1,544 N per actuator' }],
    thumbUrl: '/img/concepts/biparting.webp', meshySource: '/img/meshy/biparting-skylight.png', arWidth: 2.4, massing: { w: 7, d: 6, h: 3.2 }, status: 'Concept' },
  { id: 'lb1-sliding-rooflight', title: 'LB-1 Sliding Rooflight', channel: 'skylights', mechanism: 'slide', order: 2,
    tagline: 'The panel lifts 8 mm off its seal, glides onto the roof and opens the room to the sky in 13.6 seconds.',
    specs: [{ k: 'Aperture', v: '1.5 × 2.0 m' }, { k: 'Glass', v: '10.38 heat-strengthened laminated' }, { k: 'Peak drive', v: '744 N' }, { k: 'Open time', v: '13.6 s' }],
    thumbUrl: '', meshySource: '', massing: { w: 8, d: 6, h: 3.2 }, status: 'In development' },
  { id: 'lbp-louvred-roof', title: 'LB-P Louvred Roof', channel: 'skylights', mechanism: 'louvre', order: 3,
    tagline: 'Aluminium blades rotate on a single actuator — the lowest drive force in the family, and the simplest roof to keep dry.',
    specs: [{ k: 'Blade spacing', v: '184 mm' }, { k: 'Rotation', v: '0–135°' }, { k: 'Drive', v: '100 N for the whole roof' }, { k: 'Rain', v: 'Sensor closes the blades' }],
    thumbUrl: '', meshySource: '', massing: { w: 6, d: 5, h: 2.8 }, status: 'Concept' },

  /* ---- CH 102 Pavilions ---- */
  { id: 'lumen-curved-pavilion', title: 'Lumen Builds Curved Pavilion', channel: 'pavilions', mechanism: 'hinged', order: 10,
    tagline: 'A free-form white shell with a sheltered drive-in court and a bi-parting skylight at the crest.',
    specs: [{ k: 'Roof light', v: 'Bi-parting, 2 leaves' }, { k: 'Form', v: 'Free-form curved shell' }, { k: 'Walls', v: 'Coursed white stone, red fins' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/lumen-curved-pavilion.webp', meshySource: '/img/meshy/lumen-curved-pavilion.png', massing: { w: 10, d: 7, h: 3.2 }, status: 'Concept' },
  { id: 'studio-ring-stage', title: 'Circular Ring Pavilion', channel: 'pavilions', mechanism: 'hinged', order: 11,
    tagline: 'A white ring roof floating over a glazed drum, open to the sky at its centre, with twin roof lights on the rim.',
    specs: [{ k: 'Roof lights', v: 'Twin hinged panels' }, { k: 'Form', v: 'Ring roof over a glazed drum' }, { k: 'Centre', v: 'Open oculus courtyard' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/studio-ring-stage.webp', meshySource: '/img/meshy/studio-ring-stage.png', massing: { w: 12, d: 12, h: 2.4 }, status: 'Concept' },
  { id: 'zambezi-curve-pavilion', title: 'Zambezi Curve Pavilion', channel: 'pavilions', mechanism: 'hinged', order: 12,
    tagline: 'A double-curved canopy on red steel ribs, shaped like water over rock, with a bi-parting light at its crest.',
    specs: [{ k: 'Roof light', v: 'Bi-parting over the crest' }, { k: 'Form', v: 'Double-curved shell canopy' }, { k: 'Frame', v: 'Red steel arch ribs' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/zambezi-curve-pavilion.webp', meshySource: '/img/meshy/zambezi-curve-pavilion.png', massing: { w: 10, d: 6, h: 3 }, status: 'Concept' },

  /* ---- CH 103 Residences ---- */
  { id: 'conical-tower-loft', title: 'Conical Tower Loft', channel: 'residences', mechanism: 'hinged', order: 20,
    tagline: 'A tapered white-stone tower in a red steel exoskeleton, crowned with a lifting skylight.',
    specs: [{ k: 'Roof light', v: 'Bi-parting crown' }, { k: 'Form', v: 'Tapered stone tower' }, { k: 'Frame', v: 'Red steel exoskeleton' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/conical-tower-loft.webp', meshySource: '/img/meshy/conical-tower-loft.png', massing: { w: 5, d: 5, h: 6 }, status: 'Concept' },
  { id: 'cantilever-pavilion', title: 'Elevated Glass Cube Residence', channel: 'residences', mechanism: 'hinged', order: 21,
    tagline: 'A glazed living box lifted on four red columns, with the skylight opening directly over the lounge.',
    specs: [{ k: 'Roof light', v: 'Bi-parting pair' }, { k: 'Structure', v: 'Four-column lifted box' }, { k: 'Glazing', v: 'Full-height façade' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/cantilever-pavilion.webp', meshySource: '/img/meshy/cantilever-pavilion.png', massing: { w: 7, d: 5, h: 3 }, status: 'Concept' },
  { id: 'terraced-hillside', title: 'Terraced Hillside Complex', channel: 'residences', mechanism: 'hinged', order: 22,
    tagline: 'A red-framed glass pavilion over dry-stone terraces, topped with a lifting skylight crown.',
    specs: [{ k: 'Roof light', v: 'Bi-parting crown' }, { k: 'Base', v: 'Stepped stone terraces' }, { k: 'Frame', v: 'Braced red steel' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/terraced-hillside.webp', meshySource: '/img/meshy/terraced-hillside.png', massing: { w: 7, d: 6, h: 3.4 }, status: 'Concept' },

  /* ---- CH 104 Heritage ---- */
  { id: 'rondavel-concept', title: 'KARLCON Rondavel Concept', channel: 'heritage', mechanism: 'hinged', order: 30,
    tagline: 'The traditional rondavel, rebuilt in white render, with an automated skylight at the apex of the cone.',
    specs: [{ k: 'Roof light', v: 'Hinged panel at the apex' }, { k: 'Form', v: 'Round drum, conical roof' }, { k: 'Heritage', v: 'Zimbabwean rondavel' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/rondavel-concept.webp', meshySource: '/img/meshy/rondavel-concept.png', massing: { w: 7, d: 7, h: 3 }, status: 'Concept' },
  { id: 'triple-rondavel-cluster', title: 'Triple Rondavel Cluster', channel: 'heritage', mechanism: 'hinged', order: 31,
    tagline: 'Three drums joined by a glazed red spine, with the skylight over the central cone.',
    specs: [{ k: 'Roof light', v: 'Bi-parting over the central cone' }, { k: 'Plan', v: 'Three drums, one glazed spine' }, { k: 'Frame', v: 'Red steel glazing link' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/triple-rondavel-cluster.webp', meshySource: '/img/meshy/triple-rondavel-cluster.png', massing: { w: 12, d: 6, h: 3 }, status: 'Concept' },
  { id: 'matobo-boulder-house', title: 'Matobo Boulder House', channel: 'heritage', mechanism: 'hinged', order: 32,
    tagline: 'Red-framed glass rooms set between granite-form boulders, after the kopjes of the Matobo Hills.',
    specs: [{ k: 'Roof light', v: 'Bi-parting pair' }, { k: 'Form', v: 'Glass rooms between boulder forms' }, { k: 'Heritage', v: 'Matobo Hills kopjes' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/matobo-boulder-house.webp', meshySource: '/img/meshy/matobo-boulder-house.png', massing: { w: 10, d: 7, h: 3.4 }, status: 'Concept' },
  { id: 'chevron-pavilion', title: 'Chevron Motif Pavilion', channel: 'heritage', mechanism: 'hinged', order: 33,
    tagline: 'A heritage pavilion wrapped in chevron screens after Great Zimbabwe, crowned with a bi-parting daylight roof.',
    specs: [{ k: 'Roof light', v: 'Bi-parting, 2 leaves' }, { k: 'Frame', v: 'Red steel portal frame' }, { k: 'Walls', v: 'Chevron-perforated panels' }, { k: 'Status', v: 'Concept' }],
    thumbUrl: '/img/concepts/chevron-pavilion.webp', meshySource: '/img/meshy/chevron-pavilion.png', massing: { w: 6, d: 6, h: 3.4 }, status: 'Concept' }
];
