/*
 * h264parser.c: a minimalistic H.264 video stream parser
 *
 * See the main source file 'vdr.c' for copyright information and
 * how to reach the author.
 *
 * The code was originally written by Reinhard Nissl <rnissl@gmx.de>,
 * and adapted to the VDR coding style by Klaus.Schmidinger@cadsoft.de.
 */

#include "tools.h"
#include "h264parser.h"

namespace H264
{
  // --- cContext ------------------------------------------------------------

  int cContext::GetFramesPerSec(void) const
  {
    const cSequenceParameterSet *SPS = ActiveSPS();
    const cSliceHeader *SH = CurrentSlice();
    if (!SH || !SPS->timing_info_present_flag || !SPS->time_scale || !SPS->num_units_in_tick)
       return -1;
    uint32_t DeltaTfiDivisor;
    if (SPS->pic_struct_present_flag) {
       if (!SPS->pic_timing_sei.Defined())
          return -1;
       switch (SPS->pic_timing_sei.pic_struct) {
         case 1:
         case 2:
              DeltaTfiDivisor = 1;
              break;
         case 0:
         case 3:
         case 4:
              DeltaTfiDivisor = 2;
              break;
         case 5:
         case 6:
              DeltaTfiDivisor = 3;
              break;
         case 7:
              DeltaTfiDivisor = 4;
              break;
         case 8:
              DeltaTfiDivisor = 6;
              break;
         default:
              return -1;
         }
       }
    else if (!SH->field_pic_flag)
       DeltaTfiDivisor = 2;
    else
       DeltaTfiDivisor = 1;

    double FPS = (double)SPS->time_scale / SPS->num_units_in_tick / DeltaTfiDivisor / (SH->field_pic_flag ? 2 : 1);
    int FramesPerSec = (int)FPS;
    if ((FPS - FramesPerSec) >= 0.5)
       FramesPerSec++;
    return FramesPerSec;
  }

  // --- cSimpleBuffer -------------------------------------------------------

  cSimpleBuffer::cSimpleBuffer(int Size)
  {
    size = Size;
    data = new uchar[size];
    avail = 0;
    gotten = 0;
  }

  cSimpleBuffer::~cSimpleBuffer()
  {
    delete data;
  }

  int cSimpleBuffer::Put(const uchar *Data, int Count)
  {
    if (Count < 0) {
       if (avail + Count < 0)
          Count = 0 - avail;
       if (avail + Count < gotten)
          Count = gotten - avail;
       avail += Count;
       return Count;
       }
    if (avail + Count > size)
       Count = size - avail;
    memcpy(data + avail, Data, Count);
    avail += Count;
    return Count;
  }

  uchar *cSimpleBuffer::Get(int &Count)
  {
    Count = gotten = avail;
    return data;
  }

  void cSimpleBuffer::Del(int Count)
  {
    if (Count < 0)
       return;
    if (Count > gotten) {
       esyslog("ERROR: invalid Count in H264::cSimpleBuffer::Del: %d (limited to %d)", Count, gotten);
       Count = gotten;
       }
    if (Count < avail)
       memmove(data, data + Count, avail - Count);
    avail -= Count;
    gotten = 0;
  }

  void cSimpleBuffer::Clear(void)
  {
    avail = gotten = 0;
  }

  // --- cParser -------------------------------------------------------------

  cParser::cParser(bool OmitPicTiming)
    : nalUnitDataBuffer(1000)
  {
    // the above buffer size of 1000 bytes wont hold a complete NAL unit but
    // should be sufficient for the relevant part used for parsing.
    omitPicTiming = OmitPicTiming; // only necessary to determine frames per second
    Reset();
  }

  void cParser::Reset(void)
  {
    context = cContext();
    nalUnitDataBuffer.Clear();
    syncing = true;
  }

  void cParser::ParseSequenceParameterSet(uint8_t *Data, int Count)
  {
    cSequenceParameterSet SPS;

    cBitReader br(Data + 1, Count - 1);
    uint32_t profile_idc = br.u(8);
    /* uint32_t constraint_set0_flag = */ br.u(1);
    /* uint32_t constraint_set1_flag = */ br.u(1);
    /* uint32_t constraint_set2_flag = */ br.u(1);
    /* uint32_t constraint_set3_flag = */ br.u(1);
    /* uint32_t reserved_zero_4bits = */ br.u(4);
    /* uint32_t level_idc = */ br.u(8);
    SPS.seq_parameter_set_id = br.ue();
    if (profile_idc == 100 || profile_idc == 110 || profile_idc == 122 || profile_idc == 144) {
       uint32_t chroma_format_idc = br.ue();
       if (chroma_format_idc == 3) {
          /* uint32_t residual_colour_transform_flag = */ br.u(1);
          }
       /* uint32_t bit_depth_luma_minus8 = */ br.ue();
       /* uint32_t bit_depth_chroma_minus8 = */ br.ue();
       /* uint32_t qpprime_y_zero_transform_bypass_flag = */ br.u(1);
       uint32_t seq_scaling_matrix_present_flag = br.u(1);
       if (seq_scaling_matrix_present_flag) {
          for (int i = 0; i < 8; i++) {
              uint32_t seq_scaling_list_present_flag = br.u(1);
              if (seq_scaling_list_present_flag) {
                 int sizeOfScalingList = (i < 6) ? 16 : 64;
                 int lastScale = 8;
                 int nextScale = 8;
                 for (int j = 0; j < sizeOfScalingList; j++) {
                     if (nextScale != 0) {
                        int32_t delta_scale = br.se();
                        nextScale = (lastScale + delta_scale + 256) % 256;
                        }
                     lastScale = (nextScale == 0) ? lastScale : nextScale;
                     }
                 }
              }
          }
       }
    SPS.log2_max_frame_num_minus4(br.ue());
    SPS.pic_order_cnt_type = br.ue();
    if (SPS.pic_order_cnt_type == 0)
       SPS.log2_max_pic_order_cnt_lsb_minus4(br.ue());
    else if (SPS.pic_order_cnt_type == 1) {
       SPS.delta_pic_order_always_zero_flag = br.u(1);
       /* int32_t offset_for_non_ref_pic = */ br.se();
       /* int32_t offset_for_top_to_bottom_field = */ br.se();
       uint32_t num_ref_frames_in_pic_order_cnt_cycle = br.ue();
       for (uint32_t i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
           /* int32_t offset_for_ref_frame = */ br.se();
           }
       }
    /* uint32_t num_ref_frames = */ br.ue();
    /* uint32_t gaps_in_frame_num_value_allowed_flag = */ br.u(1);
    /* uint32_t pic_width_in_mbs_minus1 = */ br.ue();
    /* uint32_t pic_height_in_map_units_minus1 = */ br.ue();
    SPS.frame_mbs_only_flag = br.u(1);

    if (!omitPicTiming) {
       if (!SPS.frame_mbs_only_flag) {
          /* uint32_t mb_adaptive_frame_field_flag = */ br.u(1);
          }
       /* uint32_t direct_8x8_inference_flag = */ br.u(1);
       uint32_t frame_cropping_flag = br.u(1);
       if (frame_cropping_flag) {
          /* uint32_t frame_crop_left_offset = */ br.ue();
          /* uint32_t frame_crop_right_offset = */ br.ue();
          /* uint32_t frame_crop_top_offset = */ br.ue();
          /* uint32_t frame_crop_bottom_offset = */ br.ue();
          }
       uint32_t vui_parameters_present_flag = br.u(1);
       if (vui_parameters_present_flag) {
          uint32_t aspect_ratio_info_present_flag = br.u(1);
          if (aspect_ratio_info_present_flag) {
             uint32_t aspect_ratio_idc = br.u(8);
             const uint32_t Extended_SAR = 255;
             if (aspect_ratio_idc == Extended_SAR) {
                /* uint32_t sar_width = */ br.u(16);
                /* uint32_t sar_height = */ br.u(16);
                }
             }
          uint32_t overscan_info_present_flag = br.u(1);
          if (overscan_info_present_flag) {
             /* uint32_t overscan_appropriate_flag = */ br.u(1);
             }
          uint32_t video_signal_type_present_flag = br.u(1);
          if (video_signal_type_present_flag) {
             /* uint32_t video_format = */ br.u(3);
             /* uint32_t video_full_range_flag = */ br.u(1);
             uint32_t colour_description_present_flag = br.u(1);
             if (colour_description_present_flag) {
                /* uint32_t colour_primaries = */ br.u(8);
                /* uint32_t transfer_characteristics = */ br.u(8);
                /* uint32_t matrix_coefficients = */ br.u(8);
                }
             }
          uint32_t chroma_loc_info_present_flag = br.u(1);
          if (chroma_loc_info_present_flag) {
             /* uint32_t chroma_sample_loc_type_top_field = */ br.ue();
             /* uint32_t chroma_sample_loc_type_bottom_field = */ br.ue();
             }
          SPS.timing_info_present_flag = br.u(1);
          if (SPS.timing_info_present_flag) {
             SPS.num_units_in_tick = br.u(32);
             SPS.time_scale = br.u(32);
             SPS.fixed_frame_rate_flag = br.u(1);
             }
          SPS.nal_hrd_parameters_present_flag = br.u(1);
          if (SPS.nal_hrd_parameters_present_flag)
             hrd_parameters(SPS, br);
          SPS.vcl_hrd_parameters_present_flag = br.u(1);
          if (SPS.vcl_hrd_parameters_present_flag)
             hrd_parameters(SPS, br);
          if (SPS.nal_hrd_parameters_present_flag || SPS.vcl_hrd_parameters_present_flag) {
             /* uint32_t low_delay_hrd_flag = */ br.u(1);
             }
          SPS.pic_struct_present_flag = br.u(1);
          }
       }

    context.Define(SPS);
  }

  void cParser::hrd_parameters(cSequenceParameterSet &SPS, cBitReader &br)
  {
    uint32_t cpb_cnt_minus1 = br.ue();
    /* uint32_t bit_rate_scale = */ br.u(4);
    /* uint32_t cpb_size_scale = */ br.u(4);
    for (uint32_t i = 0; i <= cpb_cnt_minus1; i++) {
        /* uint32_t bit_rate_value_minus1 = */ br.ue();
        /* uint32_t cpb_size_value_minus1 = */ br.ue();
        /* uint32_t cbr_flag = */ br.u(1);
        }
    /* uint32_t initial_cpb_removal_delay_length_minus1 = */ br.u(5);
    SPS.cpb_removal_delay_length_minus1(br.u(5));
    SPS.dpb_output_delay_length_minus1(br.u(5));
    /* uint32_t time_offset_length = */ br.u(5);
  }

  void cParser::ParsePictureParameterSet(uint8_t *Data, int Count)
  {
    cPictureParameterSet PPS;

    cBitReader br(Data + 1, Count - 1);
    PPS.pic_parameter_set_id = br.ue();
    PPS.seq_parameter_set_id = br.ue();
    /* uint32_t entropy_coding_mode_flag = */ br.u(1);
    PPS.pic_order_present_flag = br.u(1);

    context.Define(PPS);
  }

  void cParser::ParseSlice(uint8_t *Data, int Count)
  {
    cSliceHeader SH;

    cBitReader br(Data + 1, Count - 1);
    SH.nal_ref_idc(Data[0] >> 5);
    SH.nal_unit_type(Data[0] & 0x1F);
    /* uint32_t first_mb_in_slice = */ br.ue();
    SH.slice_type = br.ue();
    SH.pic_parameter_set_id = br.ue();

    context.ActivatePPS(SH.pic_parameter_set_id);
    const cSequenceParameterSet *SPS = context.ActiveSPS();

    SH.frame_num = br.u(SPS->log2_max_frame_num());
    if (!SPS->frame_mbs_only_flag) {
       SH.field_pic_flag = br.u(1);
       if (SH.field_pic_flag)
          SH.bottom_field_flag = br.u(1);
       }
    if (SH.nal_unit_type() == 5)
       SH.idr_pic_id = br.ue();
    if (SPS->pic_order_cnt_type == 0) {
       SH.pic_order_cnt_lsb = br.u(SPS->log2_max_pic_order_cnt_lsb());
       const cPictureParameterSet *PPS = context.ActivePPS();
       if (PPS->pic_order_present_flag && !SH.field_pic_flag)
          SH.delta_pic_order_cnt_bottom = br.se();
       }
    if (SPS->pic_order_cnt_type == 1 && !SPS->delta_pic_order_always_zero_flag) {
       SH.delta_pic_order_cnt[0] = br.se();
       const cPictureParameterSet *PPS = context.ActivePPS();
       if (PPS->pic_order_present_flag && !SH.field_pic_flag)
          SH.delta_pic_order_cnt[1] = br.se();
       }

    context.Define(SH);
  }

  void cParser::ParseSEI(uint8_t *Data, int Count)
  {
    // currently only used to determine frames per second
    if (omitPicTiming)
       return;
    cBitReader br(Data + 1, Count - 1);
    do
      sei_message(br);
    while (br.GetBytesAvail());
  }

  void cParser::sei_message(cBitReader &br)
  {
    uint32_t payloadType = 0;
    while (1) {
          uint32_t last_payload_type_byte = br.u(8);
          payloadType += last_payload_type_byte;
          if (last_payload_type_byte != 0xFF)
             break;
          }
    uint32_t payloadSize = 0;
    while (1) {
          uint32_t last_payload_size_byte = br.u(8);
          payloadSize += last_payload_size_byte;
          if (last_payload_size_byte != 0xFF)
             break;
          }
    sei_payload(payloadType, payloadSize, br);
  }

  void cParser::sei_payload(uint32_t payloadType, uint32_t payloadSize, cBitReader &br)
  {
    const cBitReader::cBookMark BookMark = br.BookMark();
    switch (payloadType) {
      case 0:
           buffering_period(payloadSize, br);
           break;
      case 1:
           pic_timing(payloadSize, br);
           break;
      }
    // instead of dealing with trailing bits in each message
    // go back to start of message and skip it completely
    br.BookMark(BookMark);
    reserved_sei_message(payloadSize, br);
  }

  void cParser::buffering_period(uint32_t payloadSize, cBitReader &br)
  {
    uint32_t seq_parameter_set_id = br.ue();

    context.ActivateSPS(seq_parameter_set_id);
  }

  void cParser::pic_timing(uint32_t payloadSize, cBitReader &br)
  {
    cPictureTiming PT;

    const cSequenceParameterSet *SPS = context.ActiveSPS();
    if (!SPS)
       return;
    uint32_t CpbDpbDelaysPresentFlag = SPS->nal_hrd_parameters_present_flag || SPS->vcl_hrd_parameters_present_flag;
    if (CpbDpbDelaysPresentFlag) {
       /* uint32_t cpb_removal_delay = */ br.u(SPS->cpb_removal_delay_length());
       /* uint32_t dpb_output_delay = */ br.u(SPS->dpb_output_delay_length());
       }
    if (SPS->pic_struct_present_flag) {
       PT.pic_struct = br.u(4);
       }

    context.Define(PT);
  }

  void cParser::reserved_sei_message(uint32_t payloadSize, cBitReader &br)
  {
    for (uint32_t i = 0; i < payloadSize; i++) {
        /* uint32_t reserved_sei_message_payload_byte = */ br.u(8);
        }
  }

  void cParser::PutNalUnitData(const uchar *Data, int Count)
  {
    int n = nalUnitDataBuffer.Put(Data, Count);
    // typically less than a complete NAL unit are needed for parsing the
    // relevant data, so simply ignore the overflow condition.
    if (false && n != Count)
       esyslog("ERROR: H264::cParser::PutNalUnitData(): NAL unit data buffer overflow");
  }

  void cParser::Process()
  {
    // nalUnitDataBuffer contains the head of the current NAL unit -- let's parse it 
    int Count = 0;
    uchar *Data = nalUnitDataBuffer.Get(Count);
    if (Data && Count >= 4) {
       if (Data[0] == 0x00 && Data[1] == 0x00 && Data[2] == 0x01) {
          int nal_unit_type = Data[3] & 0x1F;
          try {
              switch (nal_unit_type) {
                case 1: // coded slice of a non-IDR picture
                case 2: // coded slice data partition A
                case 5: // coded slice of an IDR picture
                     ParseSlice(Data + 3, Count - 3);
                     break;
                case 6: // supplemental enhancement information (SEI)
                     ParseSEI(Data + 3, Count - 3);
                     break;
                case 7: // sequence parameter set
                     syncing = false; // from now on, we should get reliable results
                     ParseSequenceParameterSet(Data + 3, Count - 3);
                     break;
                case 8: // picture parameter set
                     ParsePictureParameterSet(Data + 3, Count - 3);
                     break;
                }
              }
          catch (cException *e) {
              if (!syncing) // suppress typical error messages while syncing
                 esyslog(e->Message());
              delete e;
              }
          }
       else if (!syncing)
          esyslog("ERROR: H264::cParser::Process(): NAL unit data buffer content is invalid");
       }
    else if (!syncing)
       esyslog("ERROR: H264::cParser::Process(): NAL unit data buffer content is too short");
    // reset the buffer for the next NAL unit
    nalUnitDataBuffer.Clear();
  }
}

