import Dao from './dao';

class UserDao extends Dao {
  constructor() {
    super('users');
  }
}

const userDao = new UserDao();
export default userDao;
