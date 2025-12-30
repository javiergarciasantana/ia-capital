import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  async findByRole(role?: string): Promise<User[]> {
    if (role) return this.userRepository.find({ where: { role: role as UserRole } });
    return this.userRepository.find();
  }

  async findAllClients(): Promise<User[]> {
    return this.userRepository.find({ where: { role: 'client' } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.findByEmail(dto.email);
    if (exists) throw new BadRequestException('El email ya existe');

    const user = this.userRepository.create({
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      role: dto.role ?? 'client',
      isActive: dto.isActive ?? true,
      profile: dto.profile
        ? {
            ...dto.profile,
            feePercentage: dto.profile.feePercentage,
            feeInterval: dto.profile.feeInterval as 'quarterly' | 'biannual' | undefined,
            preferredCurrency: dto.profile.preferredCurrency,
          }
        : null,
    });

    const saved = await this.userRepository.save(user);
    // No devuelvas el password
    const { password, ...clean } = saved as any;
    return clean;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.email && dto.email !== user.email) {
      const exists = await this.findByEmail(dto.email);
      if (exists) throw new BadRequestException('El email ya existe');
      user.email = dto.email;
    }

    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.role) user.role = dto.role;
    if (typeof dto.isActive === 'boolean') user.isActive = dto.isActive;

    if (dto.profile) {
      user.profile = { ...(user.profile || {}), ...dto.profile } as any;
    }

    const saved = await this.userRepository.save(user);
    const { password, ...clean } = saved as any;
    return clean;
  }

  async activate(id: number): Promise<User> {
    return this.update(id, { isActive: true });
  }

  async deactivate(id: number): Promise<User> {
    return this.update(id, { isActive: false });
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async removeAll(): Promise<void> {
    const users = await this.userRepository.find({ where: { role: Not('admin') } });
    if (users.length > 0) {
      await this.userRepository.remove(users);
    }
  }
}
