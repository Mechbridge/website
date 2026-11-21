/* Mechbridge sign-in screen: plain-language button and an example address in the email field.
 * Runs after Elastic has rebuilt the form (it copies each label into the placeholder). */
window.addEventListener('load', function () {
  var button = document.getElementById('rcmloginsubmit');
  if (button) button.textContent = 'Sign in';
  var user = document.getElementById('rcmloginuser');
  if (user) { user.setAttribute('placeholder', 'name@mechbridgegroup.com'); user.setAttribute('autocomplete', 'username'); user.setAttribute('inputmode', 'email'); }
  var pass = document.getElementById('rcmloginpwd');
  if (pass) { pass.setAttribute('placeholder', ''); pass.setAttribute('autocomplete', 'current-password'); }
});
