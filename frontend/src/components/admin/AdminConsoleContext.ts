import { createContext, useContext } from 'react';
import type { Me } from '../../pages/admin/api';

export const AdminMeContext = createContext<Me | null>(null);
export const useAdminMe = () => useContext(AdminMeContext);
