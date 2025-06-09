// middleware/companyAuthMiddleware.js
export const isCompanyAuthenticated = (req, res, next) => {
  console.log("Authenticated company:", req.user);
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized: Please log in",
      redirect: "/company/login",
    });
  }
  next();
};
