import React from "react";
import "./BallAnimation.css";
import naveImg from "../assets/images/nave.png";

const BallAnimation = () => {
  return (
    <div className="ball-animation-bg">
      <div className="bouncing-ball">
        <img
          src={naveImg}
          alt="Nave espacial"
          style={{
            width: "140px",
            height: "140px",
            objectFit: "contain",
            position: "absolute",
            top: 0,
            left: 0,
            transform: "rotate(0deg)",
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
};

export default BallAnimation;
