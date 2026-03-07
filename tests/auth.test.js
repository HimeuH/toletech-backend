require('./setup');

const request = require('supertest');
const app = require('../app');

describe('Auth — register', () => {
  const validUser = {
    name: 'Test Farmer',
    email: 'farmer@test.com',
    password: 'password123',
    phone: '+221700000001',
    role: 'AGRICULTEUR'
  };

  it('should register a new user and return 201', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@x.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.statusCode).toBe(400);
  });
});

describe('Auth — login', () => {
  // Register without phone so isVerified=true immediately
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Login User',
      email: 'loginuser@test.com',
      password: 'password123',
      role: 'AGRICULTEUR'
    });
  });

  it('should login with valid credentials and return token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'loginuser@test.com',
      password: 'password123'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return 401 for wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'loginuser@test.com',
      password: 'wrongpassword'
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 when no credentials provided', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('Auth — logout', () => {
  it('should logout and clear cookie', async () => {
    const res = await request(app).get('/api/v1/auth/logout');
    expect(res.statusCode).toBe(200);
  });
});
