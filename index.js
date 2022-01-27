const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const { initializeApp } = require("firebase-admin/app");
require("dotenv").config();
// const ObjectId = require("mongodb").ObjectId;
const app = express();
const port = process.env.PORT || 5000;

const admin = require("firebase-admin");

const serviceAccount = require("./travel-agency-24-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hg2sj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}
async function run() {
  try {
    await client.connect();
    console.log("database connected");
    const database = client.db("travelAgency");
    const blogPost = database.collection("blogPost");
    const usersCollection = database.collection("user");
    // create a document to insert

    //////////////////////// User section /////////////////////

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //////////////////////////// User section ////////////////////////////////////

    //////////////////////////// blog section ////////////////////////////////////
    // post blog
    app.post("/addBlogPost", async (req, res) => {
      const result = await blogPost.insertOne(req.body);
      res.json(result);
    });

    // get blog post
    app.get("/getAllBlogPost", async (req, res) => {
      const result = await blogPost.find({}).toArray();
      res.json(result);
    });

    // get single blog post
    app.get("/getSingleBlogPost/:id", async (req, res) => {
      const result = await blogPost.findOne({ _id: ObjectId(req.params.id) });
      res.json(result);
    });

    // get my experience posts by email address
    app.get("/getMyExperiencePost/:email", async (req, res) => {
      const result = await blogPost
        .find({ userEmail: req.params.email })
        .toArray();
      res.json(result);
    });

    // delete BlogPost by _id
    app.delete("/deleteBlogPost/:id", verifyToken, async (req, res) => {
      const result = await blogPost.deleteOne({ _id: ObjectId(req.params.id) });
      res.json(result);
    });

    // blog Status Update
    app.put("/blogStatusUpdate", async (req, res) => {
      const id = req.body.id;
      const status = req.body.status;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await blogPost.updateOne(query, updateDoc);
      res.json(result);
    });
    // Update blog
    app.put("/updateBlog/:id", async (req, res) => {
      const id = req.params.id;
      const query = await blogPost.findOne({ _id: ObjectId(id) });
      const options = { upsert: true };
      const { name, category, location, date, cost, rating, img, description } =
        req.body;
      const updateDoc = {
        $set: {
          name: name,
          category: category,
          location: location,
          date: date,
          cost: cost,
          rating: rating,
          img: img,
          description: description,
        },
      };
      const result = await blogPost.updateOne(query, updateDoc, options);
      res.json(result);
      console.log(result);
    });
    // get blog Pagination
    app.get("/blogs", async (req, res) => {
      const cursor = blogPost.find({ status: "approved" });
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let blogs;
      const count = await cursor.count();

      if (page) {
        blogs = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        blogs = await cursor.toArray();
      }

      res.send({
        count,
        blogs,
      });
    });

    //////////////////////////// blog section ////////////////////////////////////
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Run travel agency ");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
