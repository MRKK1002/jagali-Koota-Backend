const { deleteFile, uploadFile2 } = require("../middleware/AWS")
const ProductSubmission = require("../model/ProductSubmission")
const PurchaseUser = require("../model/PurchaseUser")
const fs = require("fs")
const path = require("path")

// Create a new product submission
exports.createSubmission = async (req, res) => {
  try {

    const { userPhone, products } = req.body

    // Validate input
    if (!userPhone) {
      console.error("Missing userPhone in request")
      return res.status(400).json({
        success: false,
        message: "User phone number is required",
        error: "Missing userPhone",
      })
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      console.error("Invalid products in request:", products)
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
        error: "Invalid or missing products array",
      })
    }

    // Validate user exists
    const user = await PurchaseUser.findOne({ phoneNumber: userPhone })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        error: `No user found with phone number: ${userPhone}`,
      })
    }

    // Validate each product and calculate total
    let totalAmount = 0
    for (let i = 0; i < products.length; i++) {
      const product = products[i]

      if (!product.name || typeof product.price !== "number" || typeof product.quantity !== "number") {
        return res.status(400).json({
          success: false,
          message: `Product ${i + 1} is missing required fields or has invalid data types`,
          error: "Each product must have name (string), price (number), and quantity (number)",
        })
      }

      if (product.price < 0) {
        return res.status(400).json({
          success: false,
          message: `Product ${i + 1} has invalid price`,
          error: "Price cannot be negative",
        })
      }

      if (product.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Product ${i + 1} has invalid quantity`,
          error: "Quantity must be greater than 0",
        })
      }

      // Calculate total for this product
      const productTotal = product.price * product.quantity
      totalAmount += productTotal
    }


    // Generate unique submission ID
    const submissionId = Date.now().toString()

    const submissionData = {
      submissionId,
      userId: user._id,
      userPhone,
      products,
      totalAmount, // Explicitly set the total amount
      status: "submitted",
      paymentStatus: "pending",
    }


    const submission = new ProductSubmission(submissionData)
    const savedSubmission = await submission.save()


    res.status(201).json({
      success: true,
      message: "Products submitted successfully",
      submission: savedSubmission,
    })
  } catch (error) {
    console.error("=== CREATE SUBMISSION ERROR ===")
    console.error("Error Type:", error.constructor.name)
    console.error("Error Message:", error.message)
    console.error("Error Stack:", error.stack)

    // Check for specific MongoDB errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message)
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        error: validationErrors.join(", "),
        details: error.errors,
      })
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate submission ID",
        error: "A submission with this ID already exists",
      })
    }

    res.status(500).json({
      success: false,
      message: "Error creating submission",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}

// Get all submissions for a user
exports.getUserSubmissions = async (req, res) => {
  try {
    const { userPhone } = req.params
    const { status, page = 1, limit = 10 } = req.query

    const filter = { userPhone }
    if (status) {
      filter.status = status
    }

    const submissions = await ProductSubmission.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await ProductSubmission.countDocuments(filter)

    res.status(200).json({
      success: true,
      submissions,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSubmissions: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching submissions",
      error: error.message,
    })
  }
}

// Get all submissions (admin function)
exports.getAllSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, userPhone, search } = req.query

    const filter = {}
    if (status && status !== "") filter.status = status
    if (userPhone) filter.userPhone = userPhone

    // Add search functionality
    if (search && search !== "") {
      filter.$or = [
        { userPhone: { $regex: search, $options: "i" } },
        { submissionId: { $regex: search, $options: "i" } },
      ]
    }

    const submissions = await ProductSubmission.find(filter)
      .populate("userId", "phoneNumber name isActive createdAt") // Populate user data
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await ProductSubmission.countDocuments(filter)

    res.status(200).json({
      success: true,
      submissions,
      totalPages: Math.ceil(total / limit),
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSubmissions: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching all submissions:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching submissions",
      error: error.message,
    })
  }
}

// Approve submission
exports.approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params

    const submission = await ProductSubmission.findByIdAndUpdate(
      submissionId,
      {
        status: "approved",
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    ).populate("userId", "phoneNumber name isActive createdAt")

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Submission approved successfully",
      submission,
    })
  } catch (error) {
    console.error("Error approving submission:", error)
    res.status(500).json({
      success: false,
      message: "Error approving submission",
      error: error.message,
    })
  }
}

// Reject submission
exports.rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params
    const { rejectionReason } = req.body

    const submission = await ProductSubmission.findByIdAndUpdate(
      submissionId,
      {
        status: "rejected",
        rejectionReason: rejectionReason || "No reason provided",
        rejectedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    ).populate("userId", "phoneNumber name isActive createdAt")

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Submission rejected successfully",
      submission,
    })
  } catch (error) {
    console.error("Error rejecting submission:", error)
    res.status(500).json({
      success: false,
      message: "Error rejecting submission",
      error: error.message,
    })
  }
}

// Get single submission by ID
exports.getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params

    const submission = await ProductSubmission.findOne({ submissionId }).populate(
      "userId",
      "phoneNumber name isActive createdAt",
    )

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    res.status(200).json({
      success: true,
      submission,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching submission",
      error: error.message,
    })
  }
}

// Update submission status
exports.updateSubmissionStatus = async (req, res) => {
  try {
    const { submissionId } = req.params
    const { status, rejectionReason, approvedBy } = req.body

    const validStatuses = [
      "submitted",
      "pending",
      "approved",
      "qr_uploaded",
      "payment_uploaded",
      "bill_uploaded",
      "rejected",
      "completed",
    ]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      })
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    }

    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason
    }

    if (status === "approved") {
      updateData.approvedBy = approvedBy
      updateData.approvedAt = new Date()
    }

    if (status === "completed") {
      updateData.completedAt = new Date()
    }

    const submission = await ProductSubmission.findOneAndUpdate({ submissionId }, updateData, { new: true })

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    res.status(200).json({
      success: true,
      message: `Submission ${status} successfully`,
      submission,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating submission status",
      error: error.message,
    })
  }
}

// Upload QR code for submission
exports.uploadQRCode = async (req, res) => {
  try {
    const { submissionId } = req.params

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "QR code image is required",
      })
    }

    const submission = await ProductSubmission.findOne({ submissionId })
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    if (submission.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Can only upload QR code for approved submissions",
      })
    }

    // Delete old QR code if exists
    if (submission.qrCodeUri) {
     await deleteFile(submission.qrCodeUri); // Assuming deleteFile is a function to delete files
    }

    let qrCodeUri=await uploadFile2(req.file, "qr_codes")
    const updatedSubmission = await ProductSubmission.findOneAndUpdate(
      { submissionId },
      {
        qrCodeUri: qrCodeUri,
        status: "qr_uploaded",
        updatedAt: new Date(),
      },
      { new: true },
    )

    res.status(200).json({
      success: true,
      message: "QR code uploaded successfully",
      submission: updatedSubmission,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error uploading QR code",
      error: error.message,
    })
  }
}

// Get approved submissions for QR upload
exports.getApprovedSubmissions = async (req, res) => {
  try {
    const { userPhone } = req.params

    const submissions = await ProductSubmission.find({
      userPhone,
      status: "approved",
    })
      .populate("userId", "phoneNumber name isActive createdAt")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      submissions,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching approved submissions",
      error: error.message,
    })
  }
}

// Get payment uploaded submissions for bill upload
exports.getPaymentUploadedSubmissions = async (req, res) => {
  try {
    const { userPhone } = req.params

    const submissions = await ProductSubmission.find({
      userPhone,
      status: "payment_uploaded",
      paymentImageUri: { $ne: null },
    })
      .populate("userId", "phoneNumber name isActive createdAt")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      submissions,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment uploaded submissions",
      error: error.message,
    })
  }
}

// Delete submission
exports.deleteSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params

    const submission = await ProductSubmission.findOne({ submissionId })
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    // Delete QR code file if exists
    if (submission.qrCodeUri) {
     await deleteFile(submission.qrCodeUri); // Assuming deleteFile is a function to delete files
    }

    // Delete payment image file if exists
    if (submission.paymentImageUri) {
   await deleteFile(submission.paymentImageUri); // Assuming deleteFile is a function to delete files
    }

    // Delete bill image file if exists
    if (submission.billImageUri) {
     await deleteFile(submission.billImageUri); // Assuming deleteFile is a function to delete files
    }

    await ProductSubmission.findOneAndDelete({ submissionId })

    res.status(200).json({
      success: true,
      message: "Submission deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting submission",
      error: error.message,
    })
  }
}

// Get submission statistics
exports.getSubmissionStats = async (req, res) => {
  try {
    const { userPhone } = req.query

    const matchStage = userPhone ? { userPhone } : {}

    const stats = await ProductSubmission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ])

    const totalSubmissions = await ProductSubmission.countDocuments(matchStage)
    const totalAmount = await ProductSubmission.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    res.status(200).json({
      success: true,
      stats: {
        byStatus: stats,
        totalSubmissions,
        totalAmount: totalAmount[0]?.total || 0,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    })
  }
}

// Upload payment image for submission
exports.uploadPaymentImage = async (req, res) => {
  try {
    const { submissionId } = req.params

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment image is required",
      })
    }

    const submission = await ProductSubmission.findById(submissionId)
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    if (submission.status !== "qr_uploaded") {
      return res.status(400).json({
        success: false,
        message: "Can only upload payment image for submissions with QR code uploaded",
      })
    }

    // Delete old payment image if exists
    if (submission.paymentImageUri) {
  await deleteFile(submission.paymentImageUri); // Assuming deleteFile is a function to delete files
    }
    const paymentImageUri = await uploadFile2(req.file, "payment_images")
    const updatedSubmission = await ProductSubmission.findByIdAndUpdate(
      submissionId,
      {
        paymentImageUri: paymentImageUri,
        status: "payment_uploaded",
        paymentStatus: "successful",
        paymentUploadedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    )

    res.status(200).json({
      success: true,
      message: "Payment image uploaded successfully! Payment Successful.",
      submission: updatedSubmission,
    })
  } catch (error) {
    console.error("Error uploading payment image:", error)
    res.status(500).json({
      success: false,
      message: "Error uploading payment image",
      error: error.message,
    })
  }
}

// Upload bill image for submission
exports.uploadBillImage = async (req, res) => {
  try {
    const { submissionId } = req.params

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Bill image is required",
      })
    }

    const submission = await ProductSubmission.findById(submissionId)
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    if (submission.status !== "payment_uploaded" || !submission.paymentImageUri) {
      return res.status(400).json({
        success: false,
        message: "Can only upload bill image for submissions with payment image uploaded",
      })
    }

    // Delete old bill image if exists
    if (submission.billImageUri) {
    await deleteFile(submission.billImageUri); // Assuming deleteFile is a function to delete files
    }

    const billImageUri = await uploadFile2(req.file, "bill_images")
    const updatedSubmission = await ProductSubmission.findByIdAndUpdate(
      submissionId,
      {
        billImageUri: billImageUri,
        status: "bill_uploaded",
        billUploadedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    )

    res.status(200).json({
      success: true,
      message: "Bill image uploaded successfully!",
      submission: updatedSubmission,
    })
  } catch (error) {
    console.error("Error uploading bill image:", error)
    res.status(500).json({
      success: false,
      message: "Error uploading bill image",
      error: error.message,
    })
  }
}

// Mark submission as completed
exports.completeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params

    const submission = await ProductSubmission.findById(submissionId)
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      })
    }

    if (submission.status !== "bill_uploaded" || !submission.billImageUri) {
      return res.status(400).json({
        success: false,
        message: "Can only complete submissions with bill image uploaded",
      })
    }

    const updatedSubmission = await ProductSubmission.findByIdAndUpdate(
      submissionId,
      {
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    )

    res.status(200).json({
      success: true,
      message: "Submission marked as completed",
      submission: updatedSubmission,
    })
  } catch (error) {
    console.error("Error completing submission:", error)
    res.status(500).json({
      success: false,
      message: "Error completing submission",
      error: error.message,
    })
  }
}