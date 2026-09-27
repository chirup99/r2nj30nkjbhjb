import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { type InsertUser, type User } from "@shared/schema";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const ddbDocClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "Users";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySlug(slug: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  async getUserBySlug(slug: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.uniqueSlug === slug);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const newUser: User = {
      ...insertUser,
      id,
      createdAt: new Date().toISOString() as any,
      email: insertUser.email || "",
      password: insertUser.password || "",
      name: insertUser.name || null,
      role: insertUser.role || null,
      bio: insertUser.bio || null,
      instagram: insertUser.instagram || null,
      linkedin: insertUser.linkedin || null,
      whatsapp: insertUser.whatsapp || null,
      website: insertUser.website || null,
      industry: insertUser.industry || null,
      uniqueSlug: insertUser.uniqueSlug || null,
      connections: insertUser.connections || [],
      cards: insertUser.cards || [],
      notes: insertUser.notes || [],
      pin: insertUser.pin || null,
      reachCount: 0,
      instaClicks: 0,
      linkedinClicks: 0,
      whatsappClicks: 0,
      websiteClicks: 0,
      reachHistory: [],
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: string, partialUser: Partial<InsertUser>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...partialUser };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
}

async function ensureTableExists(): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`DynamoDB table "${TABLE_NAME}" exists.`);
    return true;
  } catch (e: any) {
    if (e.name === "ResourceNotFoundException") {
      console.log(`DynamoDB table "${TABLE_NAME}" not found. Creating it...`);
      try {
        await client.send(new CreateTableCommand({
          TableName: TABLE_NAME,
          AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
          KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
          BillingMode: "PAY_PER_REQUEST",
        }));
        // Wait for the table to become active
        let active = false;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const { Table } = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
            if (Table?.TableStatus === "ACTIVE") { active = true; break; }
          } catch (_) {}
        }
        if (active) {
          console.log(`DynamoDB table "${TABLE_NAME}" created successfully.`);
          return true;
        } else {
          console.error(`DynamoDB table "${TABLE_NAME}" creation timed out.`);
          return false;
        }
      } catch (createErr: any) {
        console.error("Failed to create DynamoDB table:", createErr.message);
        return false;
      }
    }
    console.error("DynamoDB connectivity error:", e.message);
    return false;
  }
}

export class DynamoDBStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const { Item } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      }));
      return Item as User | undefined;
    } catch (e: any) {
      console.error("DynamoDB Get Error:", e.message);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      console.log("Searching user by email:", email);
      const { Items } = await ddbDocClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email },
      }));
      const user = (Items && Items.length > 0) ? (Items[0] as User) : undefined;
      console.log("User found by email:", user ? user.id : "none");
      return user;
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.warn(`DynamoDB table "${TABLE_NAME}" not found during getUserByEmail.`);
        return undefined;
      }
      console.error("Error getting user by email from DynamoDB:", error.message);
      return undefined;
    }
  }

  async getUserBySlug(slug: string): Promise<User | undefined> {
    try {
      console.log("Searching user by slug:", slug);
      const { Items } = await ddbDocClient.send(new ScanCommand({
        TableName: TABLE_NAME,
      }));
      const user = Items?.find(item =>
        String(item.uniqueSlug).toLowerCase() === String(slug).toLowerCase()
      ) as User | undefined;
      console.log("User found by slug:", user ? user.id : "none");
      return user;
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.warn(`DynamoDB table "${TABLE_NAME}" not found during getUserBySlug.`);
        return undefined;
      }
      console.error("Error getting user by slug from DynamoDB:", error.message);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    console.log("Creating user in DynamoDB:", insertUser.email);
    const newUser: User = {
      ...insertUser,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString() as any,
      email: insertUser.email || "",
      password: insertUser.password || "",
      name: insertUser.name || null,
      role: insertUser.role || null,
      bio: insertUser.bio || null,
      instagram: insertUser.instagram || null,
      linkedin: insertUser.linkedin || null,
      whatsapp: insertUser.whatsapp || null,
      website: insertUser.website || null,
      industry: insertUser.industry || null,
      uniqueSlug: insertUser.uniqueSlug || null,
      connections: insertUser.connections || [],
      cards: insertUser.cards || [],
      notes: insertUser.notes || [],
      pin: insertUser.pin || null,
      reachCount: 0,
      instaClicks: 0,
      linkedinClicks: 0,
      whatsappClicks: 0,
      websiteClicks: 0,
      reachHistory: [],
    };
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newUser,
      }));
      console.log("Successfully created user:", newUser.id);
      return newUser;
    } catch (error: any) {
      console.error("Error creating user in DynamoDB:", error.message);
      throw error;
    }
  }

  async updateUser(id: string, partialUser: Partial<InsertUser>): Promise<User> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(partialUser).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    if (updateExpression.length === 0) {
      const user = await this.getUser(id);
      if (!user) throw new Error("User not found");
      return user;
    }

    const { Attributes } = await ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    }));

    return Attributes as User;
  }
}

const hasAwsCredentials =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_ACCESS_KEY_ID.length > 0 &&
  process.env.AWS_SECRET_ACCESS_KEY.length > 0;

// Initialize storage — if DynamoDB credentials exist, verify/create the table,
// then use DynamoDBStorage. Otherwise fall back to in-memory.
let _storage: IStorage = new MemStorage();

export async function initStorage(): Promise<void> {
  if (!hasAwsCredentials) {
    console.log("No AWS credentials found — using in-memory storage.");
    _storage = new MemStorage();
    return;
  }
  const tableReady = await ensureTableExists();
  if (tableReady) {
    _storage = new DynamoDBStorage();
    console.log("Using DynamoDB storage.");
  } else {
    console.warn("DynamoDB unavailable — falling back to in-memory storage.");
    _storage = new MemStorage();
  }
}

export const storage: IStorage = new Proxy({} as IStorage, {
  get(_target, prop) {
    return (_storage as any)[prop].bind(_storage);
  },
});
