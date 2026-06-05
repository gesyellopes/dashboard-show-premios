export const MOCK_USERS = [
  {
    id: 1,
    phone: "38988447177",
    password: "admin123",
    name: "Thiago Ribeiro",
    role: "admin",
    avatar: "https://ui-avatars.com/api/?name=Thiago+Ribeiro&background=0D8ABC&color=fff",
    department: "Gestão",
    email: "admin@example.com",
    location: "São Paulo, SP"
  },
  {
    id: 2,
    phone: "38999412329",
    password: "joao123",
    name: "João Nunes",
    role: "manager",
    avatar: "https://ui-avatars.com/api/?name=João+Nunes&background=06D6A0&color=fff",
    department: "Vendas",
    email: "gerente@example.com",
    location: "Belo Horizonte, MG"
  },
  {
    id: 3,
    phone: "38998151209",
    password: "messias456",
    name: "Messias",
    role: "manager",
    avatar: "https://ui-avatars.com/api/?name=Messias&background=00B4D8&color=fff",
    department: "Operações",
    email: "gerente2@example.com",
    location: "Buritizeiro - MG"
  },
  {
    id: 4,
    phone: "38998028580",
    password: "jaq8580",
    name: "Jaques",
    role: "manager",
    avatar: "https://ui-avatars.com/api/?name=Jaques&background=00B4D8&color=fff",
    department: "Operações",
    email: "gerente2@example.com",
    location: "Buritizeiro - MG"
  },
  {
    id: 5,
    phone: "38999798092",
    password: "vivi9979",
    name: "Viviany de Paula",
    role: "manager",
    avatar: "https://ui-avatars.com/api/?name=Viviany+Paula&background=00B4D8&color=fff",
    department: "Operações",
    email: "gerente2@example.com",
    location: "Buritizeiro - MG"
  }
];

export const ROLE_PERMISSIONS = {
  admin: ["read", "write", "delete", "manage_users"],
  manager: ["read", "write", "manage_vendors"]
};
