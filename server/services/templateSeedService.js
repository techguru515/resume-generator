const Template = require('../models/Template');
const {
  EXECUTIVE_HANDLEBARS_HTML,
  EXECUTIVE_BASE_CSS,
  CLASSIC_HANDLEBARS_HTML,
  CLASSIC_HANDLEBARS_CSS,
  EXECUTIVE_COLOR_CSS_EXTRA,
} = require('./resumeHandlebarsSeeds');

async function upsertHandlebarsByNameOrLegacy({ name, legacyMatch, html, css, adminUserId }) {
  let doc = await Template.findOne({ name });
  if (!doc && legacyMatch) doc = await Template.findOne(legacyMatch);
  const core = { name, kind: 'handlebars', html, css, builtInKey: null, isPublic: true };
  if (doc) await Template.updateOne({ _id: doc._id }, { $set: core });
  else await Template.create({ ...core, createdBy: adminUserId });
}

async function seedTemplates({ adminUserId = null } = {}) {
  await upsertHandlebarsByNameOrLegacy({
    name: 'Classic',
    legacyMatch: { kind: 'built_in', builtInKey: 'classic' },
    html: CLASSIC_HANDLEBARS_HTML,
    css: CLASSIC_HANDLEBARS_CSS,
    adminUserId,
  });

  await upsertHandlebarsByNameOrLegacy({
    name: 'Executive (Two-column)',
    legacyMatch: { kind: 'built_in', builtInKey: 'executive' },
    html: EXECUTIVE_HANDLEBARS_HTML,
    css: EXECUTIVE_BASE_CSS,
    adminUserId,
  });

  const colorCss = `${EXECUTIVE_BASE_CSS}\n${EXECUTIVE_COLOR_CSS_EXTRA}`;
  let colorDoc = await Template.findOne({ name: 'Executive (Color)' });
  if (colorDoc) {
    await Template.updateOne(
      { _id: colorDoc._id },
      {
        $set: {
          kind: 'handlebars',
          html: EXECUTIVE_HANDLEBARS_HTML,
          css: colorCss,
          builtInKey: null,
          isPublic: true,
        },
      }
    );
  } else {
    await Template.create({
      name: 'Executive (Color)',
      kind: 'handlebars',
      html: EXECUTIVE_HANDLEBARS_HTML,
      css: colorCss,
      isPublic: true,
      createdBy: adminUserId,
    });
  }

  await Template.deleteMany({
    kind: 'built_in',
    builtInKey: { $in: ['classic', 'executive'] },
  });

  await Template.updateMany(
    { kind: 'built_in', builtInKey: 'minimal' },
    { $set: { isPublic: false, name: 'Minimal (deprecated)' } }
  );

  await Template.updateMany(
    {
      $and: [
        { name: { $nin: ['Classic', 'Executive (Two-column)', 'Executive (Color)'] } },
        { isPublic: true },
      ],
    },
    { $set: { isPublic: false } }
  );
}

module.exports = { seedTemplates };
