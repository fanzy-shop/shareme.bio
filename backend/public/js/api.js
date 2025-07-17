export async function publish(data){
  const res=await fetch('/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  return res.json();
}

export async function checkUrl(slug){
  const res=await fetch('/check-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug})});
  return res.json();
} 