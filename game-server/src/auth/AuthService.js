class AuthService {
  constructor({ pool, authBypass }) {
    this.pool = pool
    this.authBypass = authBypass
  }

  async verifyToken(token) {
    if (this.authBypass) {
      return {
        id: 0,
        username: 'Developer',
        is_admin: true,
      }
    }

    if (!token) {
      return null
    }

    return null
  }
}

module.exports = AuthService
