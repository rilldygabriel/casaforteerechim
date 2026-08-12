try {
  var casaForteTheme = localStorage.getItem("casa-forte-theme");
  if (casaForteTheme !== "light" && casaForteTheme !== "dark") {
    casaForteTheme = "dark";
  }
  document.documentElement.dataset.theme = casaForteTheme;
  document.documentElement.style.colorScheme = casaForteTheme;
} catch (error) {
  document.documentElement.dataset.theme = "dark";
}
