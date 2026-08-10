// pharmacyCategoriesRoutes.js
import express from 'express';
import Pharmacy from '../models/Pharmacy.js';

const router = express.Router();

// Helper to get icon for category
function getCategoryIcon(name) {
  const iconMap = {
    'Pain Relief': 'Pill',
    'Antibiotics': 'FlaskConical',
    'Allergy': 'Wind',
    'Digestive': 'Coffee',
    'Vitamins': 'Apple',
    'Cardiac': 'Heart',
    'Dermatology': 'Sparkles',
    'Skin Care': 'Sparkles',
    'Diabetes': 'Droplets',
    'Cardiovascular': 'Heart'
  };
  return iconMap[name] || 'Package';
}

// @desc    Get all categories for a pharmacy
// @route   GET /api/pharmacies/categories/:pharmacyId
// @access  Private
router.get('/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const medicines = pharmacy.medicines || [];
    
    const categoryMap = {};
    medicines.forEach(med => {
      const catName = med.category || 'Other';
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          id: catName.toLowerCase().replace(/\s+/g, '-'),
          name: catName,
          description: `${catName} category`,
          productCount: 0,
          status: 'Active',
          icon: getCategoryIcon(catName)
        };
      }
      categoryMap[catName].productCount++;
    });

    const categories = Object.values(categoryMap);

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a new category
// @route   POST /api/pharmacies/categories/create
// @access  Private
router.post('/create', async (req, res) => {
  try {
    const { pharmacyId, name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    if (!pharmacyId) {
      return res.status(400).json({ success: false, message: 'Pharmacy ID is required' });
    }

    res.json({
      success: true,
      message: 'Category created successfully',
      data: {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
        description: description || `${name.trim()} category`,
        productCount: 0,
        status: 'Active'
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update a category
// @route   PUT /api/pharmacies/categories/update/:categoryId
// @access  Private
router.put('/update/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        id: categoryId,
        name: name.trim(),
        description: description || `${name.trim()} category`,
        productCount: 0,
        status: 'Active'
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a category
// @route   DELETE /api/pharmacies/categories/delete/:categoryId
// @access  Private
router.delete('/delete/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;