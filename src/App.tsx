import React, { useEffect, useState } from "react"

const API_URL = "ТВОЙ_APPS_SCRIPT_URL"
const API_TOKEN = "Kjhytccb18@"

export default function App() {

const [orders,setOrders] = useState([])

useEffect(()=>{

loadOrders()

},[])

async function loadOrders(){

const res = await fetch(`${API_URL}?action=courierOrders&token=${API_TOKEN}`)

const data = await res.json()

setOrders(data.orders || [])

}

function call(phone){

window.location.href = `tel:${phone}`

}

function openMap(address){

window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(address)}`)

}

function openTelegram(username,userId){

if(username){

window.open(`https://t.me/${username}`)

return

}

if(userId){

window.open(`https://t.me/user?id=${userId}`)

}

}

return (

<div style={{padding:20,fontFamily:"Arial"}}>

<h2>Заказы</h2>

{orders.map((o,i)=>(

<div key={i} style={{
border:"1px solid #ddd",
padding:15,
borderRadius:10,
marginBottom:10
}}>

<div><b>Заказ:</b> {o.orderId}</div>

<div><b>Имя:</b> {o.name}</div>

<div><b>Телефон:</b> {o.phone}</div>

<div><b>Адрес:</b> {o.address}</div>

<div><b>Сумма:</b> {o.total} ₽</div>

<div style={{marginTop:10}}>

<button onClick={()=>call(o.phone)}>Позвонить</button>

<button onClick={()=>openTelegram(o.tgUsername,o.tgUserId)} style={{marginLeft:10}}>
Telegram
</button>

<button onClick={()=>openMap(o.address)} style={{marginLeft:10}}>
Маршрут
</button>

</div>

</div>

))}

</div>

)

}
