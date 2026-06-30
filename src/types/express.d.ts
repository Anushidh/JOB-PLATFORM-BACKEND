import { IBaseUser, IAdmin, UserRole } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: IBaseUser | IAdmin;
      userRole?: UserRole;
      userId?: string;
    }
  }
}
