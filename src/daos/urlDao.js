import Dao from './dao';

class UrlDao extends Dao {
  constructor() {
    super('urls');
  }
}

export const urlDao = new UrlDao();
