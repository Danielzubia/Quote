import { storage } from "./storage";

// Create a new user for testing if needed
async function createTestUser() {
  console.log('Creating test user...');
  const existingUser = await storage.getUserByUsername('test@example.com');
  
  if (existingUser) {
    console.log('Test user already exists with ID:', existingUser.id);
    return existingUser;
  }
  
  const newUser = await storage.createUser({
    username: 'test@example.com',
    password: 'hashed_password_would_go_here'
  });
  
  console.log('Created new test user with ID:', newUser.id);
  return newUser;
}

// Create test search history entries
async function createTestHistory(userId: number) {
  console.log(`Creating test history for user ${userId}...`);
  
  // Create 3 test entries with different configurations
  const entries = [
    {
      address: "123 Main St, Denver, CO",
      parkingSpaces: 45,
      handicapSpots: 3,
      crosswalks: 2,
      lowerEstimate: 1200,
      upperEstimate: 1800,
      hasDetections: true,
      processedImageId: "data:image/jpeg;base64,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"
    },
    {
      address: "456 Oak Ave, Boulder, CO",
      total_area_sqft: 15000,
      total_area_sqyd: 1667,
      lowerEstimate: 8000,
      upperEstimate: 12000,
      hasDetections: true,
      processedImageId: "data:image/jpeg;base64,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",
      mapState: JSON.stringify({
        completedPolygons: [
          {
            points: [
              {x: 100, y: 100},
              {x: 200, y: 100},
              {x: 200, y: 200},
              {x: 100, y: 200}
            ],
            color: '#FF0000'
          }
        ],
        manualDots: [],
        lines: [],
        mode: 'area',
        capturedImage: null
      })
    },
    {
      address: "789 Pine St, Fort Collins, CO",
      parkingSpaces: 120,
      handicapSpots: 8,
      crosswalks: 4,
      arrows: 12,
      lowerEstimate: 3500,
      upperEstimate: 4800,
      hasDetections: true,
      processedImageId: "data:image/jpeg;base64,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",
      mapState: JSON.stringify({
        completedPolygons: [],
        manualDots: [
          { x: 150, y: 150, color: '#0000FF' }
        ],
        lines: [{
          points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
          color: 'red',
          width: 2,
          measurement: 45
        }],
        mode: 'spaces',
        capturedImage: null
      })
    }
  ];
  
  let createdEntries = [];
  
  for (const entry of entries) {
    const result = await storage.addSearchHistory(userId, entry);
    console.log('Created history entry:', result.id);
    createdEntries.push(result);
  }
  
  return createdEntries;
}

async function main() {
  try {
    // Create a test user or get existing one
    const user = await createTestUser();
    
    // Create test history for this user
    const history = await createTestHistory(user.id);
    
    console.log(`Created ${history.length} history entries for user ${user.id}`);
    console.log('Test data creation complete!');
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

// Run the script
main().catch(console.error);
