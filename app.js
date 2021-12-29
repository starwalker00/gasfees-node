var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// env
require('dotenv').config()
// api call
var axios = require('axios')
// isomorphic-git
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const fs = require('fs')
// json-2-csv
const json2csv = require('json-2-csv');

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
git.clone({
  fs,
  http,
  dir,
  url: 'https://github.com/starwalker00/ethgasfee-data'
})
  .then(console.log("Cloned."));

// interval in ms between calls to blocknative api for gas data
// const dataFetchIntervalInMs = 1 * 30 * 1000; // 30 seconds
const dataFetchIntervalInMs = 1 * 60 * 1000;;

// interval in ms between pushes to git repo
var gitPushIntervalInMs = 10 * 60 * 1000;
var feeEntries = [];

// fetch data loop interval
setInterval(() => {
  axios.get(
    `https://blocknative-api.herokuapp.com/data`)
    .then(response => {
      var baseFeePerGas = response.data.baseFeePerGas
      baseFeePerGas = Math.round(baseFeePerGas);
      var feeEntry = {
        "timestamp": Date.now().toString(),
        "baseFeePerGas": baseFeePerGas.toString(),
        "readableDateUTC": new Date(Date.now()).toUTCString(),
        "readableDateLocale": new Date(Date.now()).toLocaleString()
      }
      feeEntries.push(feeEntry);
      console.log("feeEntry:")
      console.dir(feeEntry)
    })
    .catch(error => console.log(
      `Error fetching data\n ${error}`))
    .finally(() => console.log(
      `Fetch loop waiting for ${dataFetchIntervalInMs} ms`)
    )
}, dataFetchIntervalInMs)

// git loop interval
setInterval(() => {
  gitAddAndCommitAndPush()
    .then(console.log("Pushed."))
    .catch(error => console.log(
      `Error in gitAddAndCommitAndPush() \n ${error}`))
    .finally(() => console.log(
      `Git loop waiting for ${gitPushIntervalInMs} ms`)
    )
}, gitPushIntervalInMs)

async function gitAddAndCommitAndPush() {
  feeEntries_toWrite = feeEntries;
  feeEntries = [];
  var currentWeek = getWeekNumber();
  var filename = currentdate.getFullYear().toString().concat("-").concat(currentWeek);
  feeEntries_csv = await json2csv.json2csvAsync(feeEntries_toWrite, { prependHeader: false });

  // write data
  await fs.promises.appendFile(path.join(dir, 'data', filename), feeEntries_csv + '\n')
  await git.add({ fs, dir: dir, filepath: path.join('data', filename) })

  // write to UPDATES.md
  await fs.promises.writeFile(path.join(dir, 'UPDATES.md'), new Date(Date.now()).toUTCString())
  await git.add({ fs, dir: dir, filepath: 'UPDATES.md' })

  // git commit then push
  git.commit({
    fs,
    dir: dir,
    author: {
      name: 'starwalker00',
      email: 'aaronwalkerup@gmail.com',
    },
    message: 'add data'
  }).then((sha) => {
    console.log(`Committed.`)
    // console.log(`sha : ${sha}`)
    return git.push({
      fs,
      http,
      dir: dir,
      url: 'https://github.com/starwalker00/ethgasfee-data.git',
      ref: 'main',
      onAuth: () => ({ username: process.env.GITHUB_TOKEN })
    })
  }).then((pushResult) => {
    if (pushResult.ok) {
      console.log(`Pushed.`)
    } else {
      console.log(`Not pushed.`)
      throw new Error(pushResult);
    }
    // console.dir(pushResult)
  }).catch((error) => {
    console.log(`Error in gitAddAndCommitAndPush() \n ${error}`)
  });
}

function getWeekNumber() {
  currentdate = new Date();
  var oneJan = new Date(currentdate.getFullYear(), 0, 1);
  var numberOfDays = Math.floor((currentdate - oneJan) / (24 * 60 * 60 * 1000));
  var currentWeek = Math.ceil((currentdate.getDay() + 1 + numberOfDays) / 7);
  // console.log(`The week number of the current date (${currentdate}) is ${currentWeek}.`);
  return currentWeek
}

module.exports = app;
