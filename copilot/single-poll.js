const questions = document.querySelectorAll('.question');
const progressBar = document.getElementById('progressBar');
const thankYou = document.getElementById('thankYou');
let currentStep = 0;

function showStep(step) {
  questions.forEach((q, i) => {
    q.classList.toggle('active', i === step);
  });
  const progress = ((step + 1) / questions.length) * 100;
  progressBar.style.width = progress + '%';
}

document.querySelectorAll('.option').forEach(option => {
  option.addEventListener('click', () => {
    currentStep++;
    if (currentStep < questions.length) {
      showStep(currentStep);
    }
  });
});

document.getElementById('submitPoll').addEventListener('click', () => {
  document.getElementById('pollForm').style.display = 'none';
  thankYou.style.display = 'block';
});

showStep(currentStep);
