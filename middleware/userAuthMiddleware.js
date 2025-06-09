// userAuthMiddleware.js
export const isUserAuthenticated = (req, res, next) => {
  if (req.user) {
    // Remove the role check for now
    return next();
  }
  return res.status(401).json({
    message: "Unauthorized: Please log in as a user",
    redirect: "/login",
  });
};
