const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const { JWKSInvalid } = require('jose-cjs/errors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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


const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const JWKS = createRemoteJWKSet(new URL(`${FRONTEND_URL}/api/auth/jwks`));


const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers?.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Authorization access denied" });
    }
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Authorization access denied" });
    }


    try {
        const { payload } = await jwtVerify(token, JWKS,);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Forbidden" });
    }

};




async function run() {
    try {
        await client.connect();
        const db = client.db("petsdata");
        const allPetsCollection = db.collection("allpets");
        const adoptionRequestsCollection = db.collection("adoptionRequests");

        // get all pets with optional search, filter, and sorting
        app.get('/all-pets', async (req, res) => {
            const { search, species, sortBy } = req.query;
            let query = {};
            try {
                if (search) {
                    query.petName = { $regex: search, $options: "i" };
                }
                if (species) {
                    query.species = { $in: [species.toLocaleLowerCase()] };
                }
                let pets = await allPetsCollection.find(query).toArray();
                if (sortBy === "fee-low-to-high") {
                    pets.sort((a, b) => a.adoptionFee - b.adoptionFee);
                } else if (sortBy === "fee-high-to-low") {
                    pets.sort((a, b) => b.adoptionFee - a.adoptionFee);
                }
                res.json(pets || []);
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // add a new pet
        app.post('/all-pets', verifyToken, async (req, res) => {
            const petData = req.body;
            try {
                const result = await allPetsCollection.insertOne(petData);
                res.status(201).json({ message: "Pet added successfully", petId: result.insertedId });
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // delete from all pets collection
        app.delete('/all-pets/:petId', verifyToken, async (req, res) => {
            const { petId } = req.params;
            try {
                const result = await allPetsCollection.deleteOne({ _id: new ObjectId(petId) });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: "Pet not found" });
                }
                res.json({ message: "Pet deleted successfully" });
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // find one pet by id
        app.get('/all-pets/:petId', verifyToken, async (req, res) => {
            const { petId } = req.params;
            const pet = await allPetsCollection.findOne({ _id: new ObjectId(petId) });
            if (!pet) {
                return res.status(404).json({ error: "Pet not found" });
            }
            res.json(pet);
        });

        // find matching pets by user id
        app.get('/all-pets/user/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params;
            const pets = await allPetsCollection.find({ userId }).toArray();
            res.json(pets);
        });

        // pet status update
        app.patch('/all-pets/:petId', verifyToken, async (req, res) => {
            const { petId } = req.params;
            const updatePayload = req.body
            const result = await allPetsCollection.updateOne(
                { _id: new ObjectId(petId) },
                { $set: updatePayload }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Pet not found" });
            }
            res.json({ message: "Pet status updated successfully" });
        });

        // Request to adopt a pet
        app.post('/adopt-pet', verifyToken, async (req, res) => {
            const { name, username, email, message, pickUpDate, requestDate, statReq, petId, userId } = req.body;
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
                res.status(500).json({ error: "Internal Server Error" });
            }
        });



        // get all adoption requests
        app.get('/adopt-pet/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params;
            try {
                const requests = await adoptionRequestsCollection.find({ userId }).toArray();
                res.json(requests);
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // get adoption requests for a specific pet
        app.get('/adopt-pet/pet/:petId', verifyToken, async (req, res) => {
            const { petId } = req.params;
            try {
                const requests = await adoptionRequestsCollection.find({ petId }).toArray();
                res.json(requests || []);
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });



        app.patch('/adopt-pet/:requestId', verifyToken, async (req, res) => {
            const { requestId } = req.params;
            const updatePayload = req.body
            const result = await adoptionRequestsCollection.updateOne(
                { _id: new ObjectId(requestId) },
                { $set: updatePayload }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Adoption request not found" });
            }
            res.json({ message: "Adoption request updated successfully" });
        });

        // delete adoption request
        app.delete('/adopt-pet/:requestId', verifyToken, async (req, res) => {
            const { requestId } = req.params;
            try {
                const result = await adoptionRequestsCollection.deleteOne({ _id: new ObjectId(requestId) });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: "Adoption request not found" });
                }
                res.json({ message: "Adoption request deleted successfully" });
            } catch (error) {
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