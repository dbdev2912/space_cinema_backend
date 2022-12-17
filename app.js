const express = require('express');

const secret = require('./secret');
const { connector } = require('./templates/db/connector.js');
const mongo = require('mongodb');

const cors = require('cors');
const axios = require('axios');
const app = express()

const { cropIMG } = require('./templates/img/cropImage.js');

const BASE_DOMAIN_NAME = "http://127.0.0.1:5000";

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

app.use(cors())
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
            if( req.session.user ){
                const user = req.session.user;
                const films = result.map( film => {
                    const { registed_seats } = film;
                    const registed_seat = registed_seats.filter( seat => seat.owner.username === user.username );
                    let is_registed = false;
                    if( registed_seat.length > 0 ){
                        is_registed = true;
                    }

                    return { ...film, is_registed }
                })
                res.send({ films })
            }
            else{

                res.send({ films: result });
            }

        })
    })
});

app.get('/api/films/:username', ( req, res ) => {

    connector( (dbo) => {
        dbo.collection('films').find({}).toArray((err, result) => {
            if(true){
                const username = req.params.username;
                const films = result.map( film => {
                    const { registed_seats } = film;
                    const registed_seat = registed_seats.filter( seat => seat.owner.username === username );
                    let is_registed = false;
                    if( registed_seat.length > 0 ){
                        is_registed = true;
                    }

                    return { ...film, is_registed }
                })
                res.send({ films })
            }
            else{
                res.send({ films: result });
            }

        })
    })
});


app.get('/api/categories/detail', (req, res) => {
    connector( (dbo) => {
        dbo.collection('films').find({}).toArray((err, result) => {
            const films = result;
            dbo.collection('categories').find({}).toArray((err, result) => {
                const cates = result.map( cate =>  {

                    cate.illustrate = films.filter( film => film.categories.indexOf(cate.name) !== -1 )[0];
                    return cate;
                })
                res.send({ categories: cates })
            })
        })
    })
});


app.get('/api/cats', ( req, res ) => {
    connector( (dbo) => {
        dbo.collection('categories').find({}).toArray((err, result) => {
            res.send({ cats: result })
        })
    })
});

app.get('/api/film/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const user = req.session.user;
    if( user ){
        connector( (dbo) => {
            dbo.collection('films').findOne({ film_id: id }, (err, result) => {
                const film = result;
                if( film ){

                    const is_registed = film.registed_seats.filter( seat => seat.owner.username === user.username ).length > 0 ? true : false;

                    res.send(200, { film: {...film, is_registed} })
                }else{
                    res.send(404, { film: null })
                }
            })
        } )
    }
    else{
        connector( (dbo) => {
            dbo.collection('films').findOne({ film_id: id }, (err, result) => {
                const film = result;
                if( film ){

                    res.send(200, { film } )
                }else{
                    res.send(404, { film: null })
                }
            })
        } )
    }
})


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
                    { ...film, img: `/images/${folder}/${folder}-${id}-1.png`, film_id: id,

                    free_seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                    registed_seats: [],
                 }
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

app.post('/api/register/ticket', (req, res) => {
    const { id, user_obj } = req.body;
    console.log("Registed Ticket")
    console.log({ id, user_obj });
    const user = user_obj ? JSON.parse(user_obj) : req.session.user;
    connector( (dbo) => {
        dbo.collection('films').findOne( {film_id: parseInt(id)}, (err, result) => {

            const film = result;

            if( film ){
                const { free_seats } = film
                if( free_seats.length > 0 ){

                    const this_user_registed_seat = film.registed_seats.filter( seat => seat.owner.username === user.username );

                    if( !this_user_registed_seat.length > 0 ){

                        const availableSeat = free_seats.shift();
                        film.free_seats = free_seats;
                        film.registed_seats = [ ...film.registed_seats, { owner: user, seat: availableSeat } ]
                        dbo.collection('films').update(
                            { film_id: parseInt(id)} ,
                            { $set: { registed_seats: film.registed_seats, free_seats: film.free_seats } },
                            (err, result) => {
                                res.send({success: true})
                        });
                    }
                    else{
                        res.send({success: false})
                    }
                }
            }else{
                res.send({success: false})
            }
        })
    })
})

app.post('/api/cancel/ticket', (req, res) => {
    const { id, user_obj } = req.body;
    const user = user_obj ? JSON.parse(user_obj) : req.session.user;
    console.log("Cancelled Ticket")
    console.log({ id, user_obj });
    connector( (dbo) => {
        dbo.collection('films').findOne( {film_id: parseInt(id)}, (err, result) => {

            const film = result;

            if( film ){
                const { free_seats, registed_seats } = film
                const registed_seat = registed_seats.filter( seat => seat.owner.username === user.username );
                if( registed_seat.length > 0 ){
                    const seatNumber = registed_seat[0].seat;

                    film.free_seats = [ ...free_seats, seatNumber ],
                    film.registed_seats = registed_seats.filter( seat => seat.seat !== seatNumber );

                    dbo.collection('films').update(
                        { film_id: parseInt(id)} ,
                        { $set: { registed_seats: film.registed_seats, free_seats: film.free_seats } },
                        (err, result) => {
                            res.send({success: true})
                    });
                }
            }
            else{
                res.send({ success: false })
            }
        })
    })
})


app.post('/api/checkin', (req, res) => {
    const { username, _id } = req.body;
    if( _id.length === 24 ){

        connector( (dbo) => {
            dbo.collection("films").findOne({ _id: new mongo.ObjectID(`${_id}`) }, (err, result) => {
                const film = result;
                if( film ){

                    const registed_seats = film.registed_seats;
                    const is_registed = registed_seats.filter( seat => seat.owner.username === username );
                    if( is_registed.length ){

                        /* UPDATE CHECKIN HERE */
                        let index = registed_seats.indexOf(is_registed[0]);
                        registed_seats[index] = { ...registed_seats[index], checked_in: true };

                        dbo.collection('films').updateOne({ _id: new mongo.ObjectID(`${_id}`) }, { $set: { registed_seats } }, (err, result) => {

                            res.send({ success: true, infor: {msg: "Response", film: film, seat: is_registed[0].seat } })

                        })

                    }else{

                        res.send({ success: false, infor: {msg: "You have not got a ticket yet!"} })
                    }

                }
                else{
                    res.send({ success: false, infor: {msg: "Oop! Film not found! What did you scan ?"} })
                }
            })
        })
    }else{
        res.send({ success: false, infor: {msg: "Oop! Film not found! What did you scan ?"} })
    }
});



app.post("/api/update/offline/data", async (req, res)=>{
    const data = JSON.parse(req.body.data);

    for( let i = 0; i < data.length; i++ ){
        let record = data[i];
        let actionIsGet  = record.action === "true" ? true : false;
        let BODY = { id: record.id, user: { username: record.username } }
        const { id, user } = BODY

        if( actionIsGet ){

            connector( (dbo) => {
                dbo.collection('films').findOne( {film_id: parseInt(id)}, (err, result) => {

                    const film = result;

                    if( film ){
                        const { free_seats } = film
                        if( free_seats.length > 0 ){

                            const this_user_registed_seat = film.registed_seats.filter( seat => seat.owner.username === user.username );

                            if( !this_user_registed_seat.length > 0 ){

                                const availableSeat = free_seats.shift();
                                film.free_seats = free_seats;
                                film.registed_seats = [ ...film.registed_seats, { owner: user, seat: availableSeat } ]
                                dbo.collection('films').update(
                                    { film_id: parseInt(id)} ,
                                    { $set: { registed_seats: film.registed_seats, free_seats: film.free_seats } },
                                    (err, result) => {

                                });
                            }
                            else{

                            }
                        }
                    }else{

                    }
                })
            })

        }else{
            connector( (dbo) => {
                dbo.collection('films').findOne( {film_id: parseInt(id)}, (err, result) => {

                    const film = result;

                    if( film ){
                        const { free_seats, registed_seats } = film
                        const registed_seat = registed_seats.filter( seat => seat.owner.username === user.username );
                        if( registed_seat.length > 0 ){
                            const seatNumber = registed_seat[0].seat;

                            film.free_seats = [ ...free_seats, seatNumber ],
                            film.registed_seats = registed_seats.filter( seat => seat.seat !== seatNumber );

                            dbo.collection('films').update(
                                { film_id: parseInt(id)} ,
                                { $set: { registed_seats: film.registed_seats, free_seats: film.free_seats } },
                                (err, result) => {

                            });
                        }
                    }
                    else{

                    }
                })
            })


        }

    }

    res.send({ success: true })

})

/* final middlewares */

app.use((req, res, next) => {
    res.send(404, { msg: "404 not found" });
})

app.listen(5000, ()=>{
    console.log("Server running on www://ws:5000");
});
