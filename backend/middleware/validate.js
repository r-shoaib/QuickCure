export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map(i => i.message);
    return res.status(400).json({ msg: "Validation failed", errors });
  }
  req.body = result.data;
  next();
};
