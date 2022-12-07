const express = require('express');

const secret = require('./secret');
const { connector } = require('./templates/db/connector.js');

const app = express()

const { cropIMG } = require('./templates/img/cropImage.js');

/* middlewares */

app.use(require('cookie-parser')(secret.cookie));
app.use(require('express-session')());
app.use( express.static('public') );
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false,
}));

app.use( bodyParser.json({ limit: "50mb" }) );

// app.use(express.json());

/* GET routing */
app.get('/', (req, res) => {
    res.send({ msg: "Hello World" });
})

app.get('/data', (req, res)=>{

});

app.get('/api/session/retrieve', (req, res)=>{
    let credential = {};
    let customer_info = {};
    if( req.session.admin ){
        credential = req.session.admin;
        return res.send({ session: true, sessionCredential: credential, customer_info })
    }else
    if( req.session.staff ){
        credential = req.session.staff;

        return res.send({ session: true, sessionCredential: credential, customer_info })
    } else
    if( req.session.user ){
        credential = req.session.user;

        connector( (dbo) => {
            dbo.collection('customer').findOne( { username: credential.username }, (err, result) => {
                const customer = result;

                return res.send({ session: true, sessionCredential: credential, customer_info: customer })
            })
        } )
    }else{

        return res.send({  session: false, sessionCredential: credential, customer_info })
    }
})

app.get('/api/signout', (req, res) => {
    delete req.session.admin;
    delete req.session.user;
    delete req.session.staff;

    res.send({});
})


app.get('/api/films', ( req, res ) => {

    connector( (dbo) => {
        dbo.collection('films').find({}).toArray((err, result) => {
            res.send({ films: result });
        })
    })
});

app.get('/api/cats', ( req, res ) => {

    connector( (dbo) => {
        dbo.collection('categories').find({}).toArray((err, result) => {
            res.send({ cats: result });
        })
    })
});


/* POST routing */

app.post('/api/login', (req, res)=>{
    const { username, password } = req.body;

    connector( (dbo) => {
        dbo.collection('accounts').findOne({ username, password } ,(err, result)=>{
            const user = result;
            const response = {
                success: false,
                location: "/login",
            }
            if( user ){
                response.success = true;
                switch (user.role) {
                    case "admin":
                        response.location = "/admin";
                        req.session.admin = user;
                        break;
                    case "staff":
                        response.location = "/staff";
                        req.session.staff = user;
                        break;
                    default:
                        response.location = "/";
                        req.session.user = user;
                        break;
                }
            }
            res.send(response)
        });
    });
});


app.post('/api/new/film', (req, res) => {
    const { film, img } = req.body;
    let id;
    const folder = "film";

    connector( (dbo) => {
        dbo.collection("keys").findOne({"type": "film_id"}, (err, result) => {
            if(!result){
                id = 0;
                dbo.collection("keys").insertOne({"type": "film_id", "current_id": 0}, (err, result) => {

                });
            }else{
                id = result.current_id + 1;
                dbo.collection("keys").update({"type": "film_id"}, { $set: { "current_id": id } }, ( err, result ) => {

                });


                cropIMG(img, id, folder, "-1");
                dbo.collection("films").insertOne(
                    { ...film, img: `/images/${folder}/${folder}-${id}-1.png`, film_id: id }
                    ,
                    function(err, result){
                        res.send({ success: true })
                });
            }
        })
    })

});


app.post('/api/cates/create', (req, res) => {
    const { cat } = req.body;
    let id;

    connector( (dbo) => {
        dbo.collection("keys").findOne({ "type": "category_id" }, (err, result) => {
            if( !result ) {
                id = 0;
                dbo.collection("keys").insertOne({"type": "category_id", "current_id": id}, (err, result) => {
                    dbo.collection("categories").insertOne( { ...cat, id }, (err, result) => {
                        res.send({ success: true })
                    } );
                })
            }else{
                id = result.current_id + 1;
                dbo.collection('keys').update({ "type": "category_id" }, { $set: {"current_id": id} }, (err, result)=> {
                    dbo.collection("categories").insertOne( { ...cat, id }, (err, result) => {
                        res.send({ success: true })
                    } );
                });
            }
        });
    })

})

app.post('/api/film/remove', (req, res) => {
    const { id } = req.body;
    connector( (dbo) => {
        dbo.collection('films').deleteOne({ film_id: id }, (err, result) => {
            res.send({success: true})
        });
    })
});

app.post('/api/cat/remove', (req, res) => {
    const { id } = req.body;
    connector( (dbo) => {
        dbo.collection('categories').deleteOne({ id }, (err, result) => {
            res.send({success: true})
        });
    })
});

/* This gonna be completed after the database at stable state */
app.post('/api/search', (req, res)=>{
    const { searchCriteria, advanced } = req.body;
    let searchResult = [{ msg: "Not completed yet" }];
    if( !advanced ){
        const { searchString } = searchCriteria;

    }else{
        const { searchString, searchQueue, releaseYear } = searchCriteria;
    }
    res.send({ searchResult })
});

/* final middlewares */

app.use((req, res, next) => {
    res.send(404, { msg: "404 not found" });
})

app.listen(5000, ()=>{
    console.log("Server running on www://ws:5000");
});
