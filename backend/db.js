const fs=require("fs"),path=require("path");
const DB_FILE=path.join(__dirname,"data.json");

function defaultData(){return{
  students:[
    {id:"S101",name:"Meet Popat",block:"3",room:"12"},
    {id:"S102",name:"Vedant Dhokai",block:"3",room:"12"},
    {id:"S103",name:"Ridham Kotak",block:"3",room:"12"}
  ],votes:{},attendance:{},fines:[]
};}

function load(){
  if(!fs.existsSync(DB_FILE))save(defaultData());
  const data=JSON.parse(fs.readFileSync(DB_FILE,"utf-8"));
  data.students=defaultData().students;
  return data;
}

function save(data){fs.writeFileSync(DB_FILE,JSON.stringify(data,null,2));}
module.exports={load,save};
