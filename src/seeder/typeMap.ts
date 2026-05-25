import { faker } from '@faker-js/faker';

type Generator = () => unknown;

const byName: Record<string, Generator> = {
  id: () => faker.string.uuid(),
  name: () => faker.person.fullName(),
  fullName: () => faker.person.fullName(),
  firstName: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  email: () => faker.internet.email(),
  phone: () => faker.phone.number(),
  phoneNumber: () => faker.phone.number(),
  username: () => faker.internet.username(),
  password: () => faker.internet.password(),
  avatar: () => faker.image.avatar(),
  profilePicture: () => faker.image.avatar(),
  title: () => faker.lorem.sentence({ min: 3, max: 6 }),
  body: () => faker.lorem.paragraphs(2),
  content: () => faker.lorem.paragraphs(2),
  description: () => faker.lorem.paragraphs(2),
  text: () => faker.lorem.paragraphs(2),
  slug: () => faker.helpers.slugify(faker.lorem.words(3)).toLowerCase(),
  url: () => faker.internet.url(),
  website: () => faker.internet.url(),
  link: () => faker.internet.url(),
  address: () => faker.location.streetAddress(),
  street: () => faker.location.streetAddress(),
  city: () => faker.location.city(),
  country: () => faker.location.country(),
  zipCode: () => faker.location.zipCode(),
  postalCode: () => faker.location.zipCode(),
  latitude: () => faker.location.latitude(),
  longitude: () => faker.location.longitude(),
  price: () => faker.commerce.price(),
  amount: () => faker.commerce.price(),
  cost: () => faker.commerce.price(),
  currency: () => faker.finance.currencyCode(),
  company: () => faker.company.name(),
  organization: () => faker.company.name(),
  role: () => faker.helpers.arrayElement(['admin', 'user', 'guest']),
  status: () => faker.helpers.arrayElement(['active', 'pending', 'archived']),
  age: () => faker.number.int({ min: 18, max: 80 }),
  rating: () => faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
  count: () => faker.number.int({ min: 1, max: 100 }),
  quantity: () => faker.number.int({ min: 1, max: 100 }),
  createdAt: () => faker.date.recent().toISOString(),
  updatedAt: () => faker.date.recent().toISOString(),
  date: () => faker.date.recent().toISOString(),
  image: () => faker.image.url(),
  photo: () => faker.image.url(),
  thumbnail: () => faker.image.url(),
};

const byType: Record<string, Generator> = {
  string: () => faker.lorem.word(),
  text: () => faker.lorem.paragraph(),
  email: () => faker.internet.email(),
  int: () => faker.number.int({ min: 1, max: 1000 }),
  number: () => faker.number.int({ min: 1, max: 1000 }),
  float: () => faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
  boolean: () => faker.datatype.boolean(),
  bool: () => faker.datatype.boolean(),
  date: () => faker.date.recent().toISOString(),
  datetime: () => faker.date.recent().toISOString(),
  uuid: () => faker.string.uuid(),
};

export function resolveGenerator(fieldName: string, fieldType: string): Generator {
  if (byName[fieldName]) return byName[fieldName];
  if (fieldName.endsWith('Id') || fieldName.endsWith('_id')) return () => faker.string.uuid();
  if (/^(is|has)[A-Z]/.test(fieldName)) return () => faker.datatype.boolean();
  return byType[fieldType.toLowerCase()] ?? (() => faker.lorem.word());
}
