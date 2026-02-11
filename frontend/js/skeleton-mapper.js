class SkeletonMapper {
    constructor() {
        this.width = 0;
        this.height = 0;
    }

    init(width, height) {
        this.width = width;
        this.height = height;
        console.log("✅ SkeletonMapper initialized");
    }

    update(poseData) {
        // For now just log pose data
        if (!poseData) return;

        // Later we will map pose landmarks to 3D jacket
        // console.log(poseData);
    }
}

// Make global
window.skeletonMapper = new SkeletonMapper();
