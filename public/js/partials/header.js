let hamButton = document.querySelector(".mobile-nav-ham");
let mobileNav = document.querySelector(".mobile-nav-con");
let body = document.querySelector('body');

let isNavRevealed = false;

function revealMobileNav(event){

    console.log(mobileNav.querySelectorAll(".dropdown"));
    
    if(isNavRevealed===false){
         mobileNav.style.right="0%";
         isNavRevealed=true;
    }else{
        mobileNav.style.right="-300%";
        isNavRevealed=false;
    }

}

function revealMobileDropdown(event) {
    
    if(event.target.nextElementSibling.style.display==="none"){
        event.target.nextElementSibling.style.display="block"
    }
    else{
        event.target.nextElementSibling.style.display="none"
    }

}


mobileNav.querySelectorAll(".dropdown").forEach((dropdown) => {
        dropdown.addEventListener('click',revealMobileDropdown);
});

hamButton.addEventListener('click',revealMobileNav)