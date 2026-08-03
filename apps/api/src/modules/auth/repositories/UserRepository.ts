import { supabase } from '../../../config/database';

export interface User {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserMapper = {
  toDomain(raw: any): User {
    return {
      id: raw.id,
      email: raw.email,
      role: raw.role,
      createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
      updatedAt: raw.updated_at ? new Date(raw.updated_at) : new Date(),
    };
  },
  toPersistence(domain: Partial<User>): any {
    const raw: any = { ...domain };
    if (domain.createdAt) raw.created_at = domain.createdAt.toISOString();
    if (domain.updatedAt) raw.updated_at = domain.updatedAt.toISOString();
    delete raw.createdAt;
    delete raw.updatedAt;
    return raw;
  }
};

export class UserRepository {
  private readonly tableName = 'users';

  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return UserMapper.toDomain(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return UserMapper.toDomain(data);
  }

  async create(payload: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(UserMapper.toPersistence(payload))
      .select()
      .single();

    if (error) throw error;
    return UserMapper.toDomain(data);
  }
}

export const userRepository = new UserRepository();
