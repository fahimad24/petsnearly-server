const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();
const PORT = process.env.PORT || 4000;


// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.DATABASE_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("petsdata");
        const allPetsCollection = db.collection("allpets");
        const adoptionRequestsCollection = db.collection("adoptionRequests");

        // find all pets
        app.get('/all-pets', async (req, res) => {
            try {
                const pets = await allPetsCollection.find({}).toArray();
                res.json(pets);
            } catch (error) {
                console.error("Error fetching pets:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // add a new pet
        app.post('/all-pets', async (req, res) => {
            const petData = req.body;
            console.log("Received pet data:", petData);
            try {
                const result = await allPetsCollection.insertOne(petData);
                res.status(201).json({ message: "Pet added successfully", petId: result.insertedId });
            } catch (error) {
                console.error("Error adding pet:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // delete from all pets collection
        app.delete('/all-pets/:petId', async (req, res) => {
            const { petId } = req.params;
            try {
                const result = await allPetsCollection.deleteOne({ _id: new ObjectId(petId) });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: "Pet not found" });
                }
                res.json({ message: "Pet deleted successfully" });
            } catch (error) {
                console.error("Error deleting pet:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // find one pet by id
        app.get('/all-pets/:petId', async (req, res) => {
            const { petId } = req.params;
            const pet = await allPetsCollection.findOne({ _id: new ObjectId(petId) });
            if (!pet) {
                return res.status(404).json({ error: "Pet not found" });
            }
            res.json(pet);
        });

        // find matching pets by user id
        app.get('/all-pets/user/:userId', async (req, res) => {
            const { userId } = req.params;
            const pets = await allPetsCollection.find({ userId }).toArray();
            res.json(pets);
        });

        // pet status update
        app.patch('/all-pets/:petId', async (req, res) => {
            const { petId } = req.params;
            const updatePayload = req.body && typeof req.body === 'object' ? req.body : {};
            const { status } = updatePayload;
            const fieldsToUpdate = Object.keys(updatePayload).length === 1 && typeof status === 'string'
                ? { status }
                : updatePayload;
            const result = await allPetsCollection.updateOne(
                { _id: new ObjectId(petId) },
                { $set: fieldsToUpdate }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Pet not found" });
            }
            res.json({ message: "Pet status updated successfully" });
        });

        // Request to adopt a pet
        app.post('/adopt-pet', async (req, res) => {
            const { name, username, email, message, pickUpDate, requestDate, statReq, petId, userId } = req.body;
            console.log("Received adoption request data:", req.body);
            const adoptionRequest = {
                name,
                username,
                email,
                message,
                pickUpDate,
                requestDate,
                statReq,
                petId,
                userId,
            };
            try {
                const result = await adoptionRequestsCollection.insertOne(adoptionRequest);
                res.status(201).json({ message: "Adoption request submitted successfully", requestId: result.insertedId });
            } catch (error) {
                console.error("Error submitting adoption request:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        // get all adoption requests
        app.get('/adopt-pet/:userId', async (req, res) => {
            const { userId } = req.params;
            console.log("Received userId :", userId);
            try {
                const requests = await adoptionRequestsCollection.find({ userId }).toArray();
                res.json(requests);
            } catch (error) {
                console.error("Error fetching adoption requests:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // delete adoption request
        app.delete('/adopt-pet/:requestId', async (req, res) => {
            const { requestId } = req.params;
            try {
                const result = await adoptionRequestsCollection.deleteOne({ _id: new ObjectId(requestId) });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: "Adoption request not found" });
                }
                res.json({ message: "Adoption request deleted successfully" });
            } catch (error) {
                console.error("Error deleting adoption request:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when it is finished with the server
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('hello world')
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})