
const enterDemo = document.getElementById("enterDemo");

if (enterDemo) {
  enterDemo.addEventListener("click", () => {
    sessionStorage.setItem("fieldShiftDemo", "true");
    window.location.href = "dashboard.html";
  });
}
