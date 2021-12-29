var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// api call
var axios = require('axios')
// isomorphic-git
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const fs = require('fs')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// git

const gitLocalFolder = path.join(process.cwd(), 'ethgasfee-data')

// Cleaning gitLocalFolder 
if (!fs.existsSync(gitLocalFolder)) {
  console.log('Folder to clone ethgasfee-data DOES NOT exist.');
  fs.mkdirSync(gitLocalFolder);
  console.log('Folder to clone ethgasfee-data Created Successfully.');
}
else {
  console.log('Folder to clone ethgasfee-data DOES exist.');
  console.log('Deleting it.');
  fs.rmSync(gitLocalFolder, { recursive: true });
}

console.log('Cloning git repository.');
var dir = gitLocalFolder;
git.clone({ fs, http, dir, url: 'https://github.com/starwalker00/ethgasfee-data' }).then(console.log("Cloned"));

// Call blocknative api for gas data
const intervalInMs = 10000;
console.log(`Waiting for ${intervalInMs} ms`)
setInterval(() => {

  axios.get(
    `https://blocknative-api.herokuapp.com/data`)
    .then(response => {
      var baseFeePerGas = response.data.baseFeePerGas
      baseFeePerGas = Math.round(baseFeePerGas);
      let feeEntry = {
        "timestamp": Date.now().toString(),
        "baseFeePerGas": baseFeePerGas.toString(),
        "readableDateUTC": new Date(Date.now()).toUTCString(),
        "readableDateLocale": new Date(Date.now()).toLocaleString()
      }
      console.log("feeEntry:")
      console.dir(feeEntry)
    })
    .catch(error => console.log(
      `Error fetching data\n ${error}`))
    .finally(() => console.log(
      `Waiting for ${intervalInMs} ms`)
    )
}, intervalInMs)

module.exports = app;
