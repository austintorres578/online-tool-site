let hamButton = document.querySelector(".mobile-nav-ham");
let mobileNav = document.querySelector(".mobile-nav-con");
let hamIcon = document.querySelector(".ham");
let xIcon = document.querySelector(".x")
let body = document.querySelector('body');

let isNavRevealed = false;

function revealMobileNav(event){

    console.log(mobileNav.querySelectorAll(".dropdown"));
    
    if(isNavRevealed===false){
         mobileNav.style.right="0%";
         isNavRevealed=true;
         xIcon.style.display="block";
         hamIcon.style.display="none";
    }else{
        mobileNav.style.right="-300%";
        isNavRevealed=false;
        xIcon.style.display="none";
        hamIcon.style.display="block";
    }

}

function revealMobileDropdown(event) {
    const dropdown = event.currentTarget;
    const sibling = dropdown.nextElementSibling;

    if (sibling.style.display === "none" || sibling.style.display === "") {
        sibling.style.display = "block";
        dropdown.classList.add('active');
    } else {
        sibling.style.display = "none";
        dropdown.classList.remove('active');
    }
}



mobileNav.querySelectorAll(".dropdown").forEach((dropdown) => {
        dropdown.addEventListener('click',revealMobileDropdown);
});

hamButton.addEventListener('click',revealMobileNav)