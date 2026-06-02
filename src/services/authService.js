import { MOCK_USERS } from "@/mocks/users";

// Simula um delay de rede
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Remove espaços e caracteres especiais do telefone
const cleanPhone = (phone) => phone.replace(/\D/g, '');

export const authService = {
  async login(phone, password) {
    await delay(500);

    const cleanedPhone = cleanPhone(phone);
    const user = MOCK_USERS.find(u => u.phone === cleanedPhone && u.password === password);

    if (!user) {
      return {
        success: false,
        message: "Telefone ou senha inválidos"
      };
    }

    // Gera um token fake
    const token = btoa(JSON.stringify({ userId: user.id, phone: user.phone, timestamp: Date.now() }));

    return {
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        department: user.department,
        email: user.email,
        location: user.location
      }
    };
  },

  async validateToken(token) {
    await delay(100);

    try {
      const decoded = JSON.parse(atob(token));
      const user = MOCK_USERS.find(u => u.id === decoded.userId);

      if (!user) {
        return { valid: false };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          department: user.department,
          phone: user.phone,
          location: user.location
        }
      };
    } catch (error) {
      return { valid: false };
    }
  },

  logout() {
    return { success: true };
  }
};
