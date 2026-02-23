require('./setup');

const request = require('supertest');
const app = require('../app');

let token;
let storageId;

const ownerPayload = {
  name: 'Storage Owner',
  email: 'owner@test.com',
  password: 'password123',
  role: 'PROPRIETAIRE'
};

const storagePayload = {
  name: 'Test Hangar',
  storageType: 'HANGAR',
  capacity: 500,
  capacityUnit: 'M2',
  costPerKgPerDay: 10,
  availableFrom: '2026-03-01',
  availableTo: '2026-12-31'
};

beforeEach(async () => {
  await request(app).post('/api/v1/auth/register').send(ownerPayload);
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: ownerPayload.email,
    password: ownerPayload.password
  });
  token = loginRes.body.token;
});

describe('Storage CRUD', () => {
  it('should create a storage (owner)', async () => {
    const res = await request(app)
      .post('/api/v1/storages')
      .set('Authorization', `Bearer ${token}`)
      .send(storagePayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    storageId = res.body.data._id;
  });

  it('should reject storage creation without auth', async () => {
    const res = await request(app).post('/api/v1/storages').send(storagePayload);
    expect(res.statusCode).toBe(401);
  });

  it('should get all storages', async () => {
    const res = await request(app).get('/api/v1/storages/search');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should get storage by ID', async () => {
    const createRes = await request(app)
      .post('/api/v1/storages')
      .set('Authorization', `Bearer ${token}`)
      .send(storagePayload);
    storageId = createRes.body.data._id;

    const res = await request(app).get(`/api/v1/storages/${storageId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(storageId);
  });

  it('should update a storage', async () => {
    const createRes = await request(app)
      .post('/api/v1/storages')
      .set('Authorization', `Bearer ${token}`)
      .send(storagePayload);
    storageId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/v1/storages/${storageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.description).toBe('Updated description');
  });

  it('should delete a storage', async () => {
    const createRes = await request(app)
      .post('/api/v1/storages')
      .set('Authorization', `Bearer ${token}`)
      .send(storagePayload);
    storageId = createRes.body.data._id;

    const res = await request(app)
      .delete(`/api/v1/storages/${storageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });
});
