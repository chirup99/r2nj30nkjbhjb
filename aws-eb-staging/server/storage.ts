import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
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

export class DynamoDBStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const { Item } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      }));
      return Item as User | undefined;
    } catch (e) {
      console.error("DynamoDB Get Error:", e);
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
    } catch (error) {
      console.error("Error getting user by email from DynamoDB:", error);
      throw error;
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
    } catch (error) {
      console.error("Error getting user by slug from DynamoDB:", error);
      throw error;
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
      // Attempt to describe table to check if it exists
      try {
        await ddbDocClient.send(new ScanCommand({ TableName: TABLE_NAME, Limit: 1 }));
      } catch (e: any) {
        if (e.name === "ResourceNotFoundException" || e.name === "UnrecognizedClientException") {
          console.error(`DynamoDB Error: ${e.name}. Ensure table "${TABLE_NAME}" exists and credentials are correct.`);
          throw new Error(`Database table "${TABLE_NAME}" not found. Please wait a moment if it was just created.`);
        }
        throw e;
      }

      await ddbDocClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newUser,
      }));
      console.log("Successfully created user:", newUser.id);
      return newUser;
    } catch (error) {
      console.error("Error creating user in DynamoDB:", error);
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

// Use DynamoDBStorage when AWS credentials are configured, otherwise fall back to in-memory
const hasAwsCredentials =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_ACCESS_KEY_ID.length > 0 &&
  process.env.AWS_SECRET_ACCESS_KEY.length > 0;

export const storage: IStorage = hasAwsCredentials
  ? new DynamoDBStorage()
  : new MemStorage();
