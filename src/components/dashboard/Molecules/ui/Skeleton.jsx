import React from "react";
import SkeletonLib from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const Skeleton = ({ count = 1, height = 20, className = "" }) => {
    return <SkeletonLib count={count} height={height} className={className} />;
};

export default Skeleton;