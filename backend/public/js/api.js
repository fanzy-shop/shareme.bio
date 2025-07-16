export async function publish(data){
  const res=await fetch('/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  return res.json();
} 