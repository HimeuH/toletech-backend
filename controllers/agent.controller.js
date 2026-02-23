const User = require('../models/User');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');

// GET /api/v1/agent/users — list farmers and owners in the agent's assignedRegion
exports.getRegionUsers = catchAsyncErrors(async (req, res, next) => {
  const agent = await User.findById(req.user.id).select('assignedRegion');

  if (!agent.assignedRegion) {
    return next(new ErrorHandler('Agent has no assigned region', 400));
  }

  const query = {
    location: { $regex: agent.assignedRegion, $options: 'i' },
    role: { $in: ['AGRICULTEUR', 'PROPRIETAIRE', 'TRANSFORMATEUR'] }
  };

  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { phone: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  if (req.query.role) {
    query.role = req.query.role;
  }

  const users = await User.find(query).select('-password');
  const farmers = users.filter(u => u.role === 'AGRICULTEUR');
  const owners = users.filter(u => ['PROPRIETAIRE', 'TRANSFORMATEUR'].includes(u.role));

  res.status(200).json({
    success: true,
    data: { farmers, owners },
    count: users.length
  });
});
