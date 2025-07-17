let hamButton = document.querySelector(".mobile-nav-ham");
let mobileNav = document.querySelector(".mobile-nav-con");
let body = document.querySelector('body');

let isNavRevealed = false;

function revealMobileNav(event){
    
    if(isNavRevealed===false){
         mobileNav.style.right="0%";
         isNavRevealed=true;
    }else{
        mobileNav.style.right="-300%";
        isNavRevealed=false;
    }

}

hamButton.addEventListener('click',revealMobileNav)