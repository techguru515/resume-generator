const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /**
     * built_in: uses server's built-in renderers (classic/executive).
     * handlebars: HTML/CSS stored in DB and rendered server-side.
     */
    kind: { type: String, enum: ['built_in', 'handlebars'], required: true },
    builtInKey: { type: String, enum: ['classic', 'minimal', 'executive'], default: null },
    html: { type: String, default: '' },
    css: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    createdBy: { type: 'ObjectId', ref: 'User', default: null },
  },
  { timestamps: true }
);

TemplateSchema.index({ name: 1 });

module.exports = mongoose.model('Template', TemplateSchema);
