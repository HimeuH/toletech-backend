const ProductType = require('../models/ProductType');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');

const DEFAULT_PRODUCTS = [
  { name: 'Mil',              category: 'Céréales' },
  { name: 'Sorgho',           category: 'Céréales' },
  { name: 'Maïs',             category: 'Céréales' },
  { name: 'Riz',              category: 'Céréales' },
  { name: 'Arachide',         category: 'Oléagineux' },
  { name: 'Sésame',           category: 'Oléagineux' },
  { name: 'Niébé',            category: 'Légumineuses' },
  { name: 'Oignon',           category: 'Légumes' },
  { name: 'Pomme de terre',   category: 'Légumes' },
  { name: 'Manioc',           category: 'Tubercules' },
  { name: 'Patate douce',     category: 'Tubercules' },
  { name: 'Tomate',           category: 'Légumes' },
  { name: 'Gombo',            category: 'Légumes' },
  { name: 'Mangue',           category: 'Fruits' },
  { name: 'Bissap',           category: 'Fruits' },
  { name: 'Poisson séché',    category: 'Produits halieutiques' },
  { name: 'Poisson frais',    category: 'Produits halieutiques' },
  { name: 'Produits laitiers',category: 'Produits animaux' },
  { name: 'Engrais',          category: 'Intrants' },
  { name: 'Semences',         category: 'Intrants' },
];

// GET /api/v1/product-types — public, active only
exports.list = catchAsyncErrors(async (req, res) => {
  const products = await ProductType.find({ isActive: true }).sort({ category: 1, name: 1 });
  res.status(200).json({ success: true, data: products });
});

// GET /api/v1/product-types/all — admin only, all
exports.listAll = catchAsyncErrors(async (req, res) => {
  const products = await ProductType.find().sort({ category: 1, name: 1 });
  res.status(200).json({ success: true, data: products });
});

// POST /api/v1/product-types — admin only
exports.create = catchAsyncErrors(async (req, res, next) => {
  const { name, category } = req.body;
  if (!name?.trim()) return next(new ErrorHandler('Le nom du produit est requis', 400));
  const product = await ProductType.create({ name: name.trim(), category: category?.trim() });
  res.status(201).json({ success: true, data: product });
});

// PUT /api/v1/product-types/:id — admin only
exports.update = catchAsyncErrors(async (req, res, next) => {
  const { name, category, isActive } = req.body;
  const product = await ProductType.findById(req.params.id);
  if (!product) return next(new ErrorHandler('Produit introuvable', 404));
  if (name !== undefined) product.name = name.trim();
  if (category !== undefined) product.category = category?.trim();
  if (isActive !== undefined) product.isActive = isActive;
  await product.save();
  res.status(200).json({ success: true, data: product });
});

// DELETE /api/v1/product-types/:id — admin only
exports.remove = catchAsyncErrors(async (req, res, next) => {
  const product = await ProductType.findById(req.params.id);
  if (!product) return next(new ErrorHandler('Produit introuvable', 404));
  await product.deleteOne();
  res.status(200).json({ success: true, message: 'Produit supprimé' });
});

// POST /api/v1/product-types/seed — admin only, idempotent
exports.seed = catchAsyncErrors(async (req, res) => {
  let created = 0;
  for (const p of DEFAULT_PRODUCTS) {
    const exists = await ProductType.findOne({ name: p.name });
    if (!exists) {
      await ProductType.create(p);
      created++;
    }
  }
  res.status(200).json({ success: true, message: `${created} produit(s) ajouté(s), ${DEFAULT_PRODUCTS.length - created} déjà présent(s).` });
});
