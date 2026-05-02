const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /**
     * built_in: legacy layouts (minimal fallback).
     * handlebars: authoritative HTML/CSS in DB — PDF + preview render through resumeRenderService.
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
